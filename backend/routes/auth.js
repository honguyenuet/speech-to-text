require('dotenv').config();
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const FREE_TRANSCRIPTION_SECONDS = 30 * 60;
const PAYG_PURCHASE_SECONDS = 10 * 60 * 60;
const PLAN_DAILY_LIMITS = {
  plus: 3 * 60 * 60,
  pro: 5 * 60 * 60,
  pre: 7 * 60 * 60,
};
let ensureUserColumnsPromise = null;

function ensureUserColumns() {
  if (!ensureUserColumnsPromise) {
    ensureUserColumnsPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS free_transcription_seconds INTEGER NOT NULL DEFAULT 1800;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS used_transcription_seconds INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS payg_seconds_remaining INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_transcription_seconds INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_quota_date DATE NOT NULL DEFAULT CURRENT_DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_daily_seconds INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_date DATE NOT NULL DEFAULT CURRENT_DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_required BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_sent_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_alert_confirmed_at TIMESTAMP WITH TIME ZONE;
      UPDATE users SET plan = 'free' WHERE plan IS NULL;
      UPDATE users SET free_transcription_seconds = 1800 WHERE free_transcription_seconds IS NULL;
      UPDATE users SET used_transcription_seconds = 0 WHERE used_transcription_seconds IS NULL;
      UPDATE users SET payg_seconds_remaining = 0 WHERE payg_seconds_remaining IS NULL;
      UPDATE users SET daily_transcription_seconds = 0 WHERE daily_transcription_seconds IS NULL;
      UPDATE users SET daily_quota_date = CURRENT_DATE WHERE daily_quota_date IS NULL;
      UPDATE users SET usage_alert_daily_seconds = 0 WHERE usage_alert_daily_seconds IS NULL;
      UPDATE users SET usage_alert_date = CURRENT_DATE WHERE usage_alert_date IS NULL;
      UPDATE users SET usage_alert_required = FALSE WHERE usage_alert_required IS NULL;
    `).catch((error) => {
      ensureUserColumnsPromise = null;
      throw error;
    });
  }
  return ensureUserColumnsPromise;
}

function serializeUser(user) {
  const freeSeconds = Number(user.free_transcription_seconds ?? FREE_TRANSCRIPTION_SECONDS);
  const usedSeconds = Number(user.used_transcription_seconds ?? 0);
  const paygSeconds = Number(user.payg_seconds_remaining ?? 0);
  const dailyLimit = PLAN_DAILY_LIMITS[user.plan] ?? null;
  const dailyUsed = user.is_daily_quota_today === false ? 0 : Number(user.daily_transcription_seconds ?? 0);
  const plan = user.plan ?? 'free';

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    avatar: user.avatar ?? null,
    plan,
    billingCycle: user.billing_cycle ?? null,
    freeTranscriptionSeconds: freeSeconds,
    usedTranscriptionSeconds: usedSeconds,
    paygSecondsRemaining: paygSeconds,
    dailyTranscriptionSeconds: dailyUsed,
    dailyQuotaSeconds: dailyLimit,
    usageAlertRequired: user.usage_alert_required ?? false,
    usageAlertDailySeconds: user.is_usage_alert_today === false ? 0 : Number(user.usage_alert_daily_seconds ?? 0),
    remainingTranscriptionSeconds:
      plan === 'free'
        ? Math.max(0, freeSeconds - usedSeconds)
        : plan === 'payg'
          ? Math.max(0, paygSeconds)
          : dailyLimit === null
            ? null
            : Math.max(0, dailyLimit - dailyUsed),
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// GET /api/auth/google — khởi tạo OAuth với Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// GET /api/auth/google/callback — Google gọi về sau khi user đăng nhập
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=google_failed`,
  }),
  async (req, res) => {
    try {
      const { googleId, email, firstName, lastName } = req.user;

      // Kiểm tra user đã tồn tại chưa
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId]
      );

      if (rows.length > 0) {
        // User đã có tài khoản → tạo token, redirect về dashboard
        const token = generateToken(rows[0]);
        return res.redirect(`${FRONTEND_URL}/dashboard?token=${token}`);
      }

      // User mới → redirect về trang đăng ký với thông tin Google
      // Dùng URL-safe base64: thay +→- /→_ bỏ = để tránh bị URLSearchParams decode sai
      const googleData = Buffer.from(
        JSON.stringify({ googleId, email, firstName, lastName })
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return res.redirect(`${FRONTEND_URL}/register?data=${googleData}`);
    } catch (error) {
      console.error('Google callback error:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// POST /api/auth/register — đăng ký tài khoản mới
router.post('/register', async (req, res) => {
  try {
    await ensureUserColumns();
    const { firstName, lastName, email, password, googleId } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Kiểm tra email đã tồn tại chưa
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email này đã được đăng ký' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, google_id, plan, free_transcription_seconds, used_transcription_seconds)
       VALUES ($1, $2, $3, $4, $5, 'free', $6, 0)
       RETURNING id, first_name, last_name, email, avatar, plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required`,
      [firstName, lastName, email, hashedPassword, googleId || null, FREE_TRANSCRIPTION_SECONDS]
    );

    const user = rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// GET /api/auth/me — lấy thông tin user hiện tại qua JWT
router.get('/me', async (req, res) => {
  try {
    await ensureUserColumns();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }

    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, avatar, plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = rows[0];
    return res.json(serializeUser(user));
  } catch (error) {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

// PATCH /api/auth/profile — cập nhật họ tên
router.patch('/profile', async (req, res) => {
  try {
    await ensureUserColumns();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }

    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ và tên' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2
       WHERE id = $3
       RETURNING id, first_name, last_name, email, avatar, plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required`,
      [firstName.trim(), lastName.trim(), decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = rows[0];
    return res.json(serializeUser(user));
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

// POST /api/auth/avatar — cập nhật ảnh đại diện (base64 data URL)
router.post('/avatar', async (req, res) => {
  try {
    await ensureUserColumns();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }

    const { avatar } = req.body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Ảnh không hợp lệ' });
    }

    // Giới hạn kích thước ~2MB base64
    if (avatar.length > 2 * 1024 * 1024 * 1.37) {
      return res.status(400).json({ error: 'Ảnh quá lớn (tối đa 2MB)' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET avatar = $1
       WHERE id = $2
       RETURNING id, first_name, last_name, email, avatar, plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required`,
      [avatar, decoded.id]
    );

    const user = rows[0];
    return res.json(serializeUser(user));
  } catch (error) {
    console.error('Update avatar error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

// POST /api/auth/upgrade — nâng cấp tài khoản lên gói trả phí
router.post('/upgrade', async (req, res) => {
  try {
    await ensureUserColumns();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const requestedPlan = String(req.body?.plan ?? 'pro').toLowerCase();
    const plan = ['payg', 'plus', 'pro', 'pre'].includes(requestedPlan) ? requestedPlan : 'pro';
    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const isPayg = plan === 'payg';

    const { rows } = await pool.query(
      `UPDATE users
       SET plan = $1::varchar,
           billing_cycle = $4::varchar,
           payg_seconds_remaining = CASE WHEN $1::varchar = 'payg' THEN payg_seconds_remaining + $3 ELSE payg_seconds_remaining END,
           daily_transcription_seconds = CASE WHEN $1::varchar IN ('plus', 'pro', 'pre') THEN 0 ELSE daily_transcription_seconds END,
           daily_quota_date = CURRENT_DATE
       WHERE id = $2
       RETURNING id, first_name, last_name, email, avatar, plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required`,
      [plan, decoded.id, isPayg ? PAYG_PURCHASE_SECONDS : 0, isPayg ? null : billingCycle]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    return res.json(serializeUser(rows[0]));
  } catch (error) {
    console.error('Upgrade account error:', error);
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// GET /api/auth/usage-alert/confirm?token=... — xác nhận tiếp tục chuyển đổi sau cảnh báo 1 giờ/ngày
router.get('/usage-alert/confirm', async (req, res) => {
  try {
    await ensureUserColumns();
    const token = String(req.query.token ?? '');
    if (!token) {
      return res.status(400).send('Thiếu token xác nhận');
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET usage_alert_required = FALSE,
           usage_alert_confirmed_at = NOW()
       WHERE usage_alert_token = $1
         AND usage_alert_date = CURRENT_DATE
       RETURNING id`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).send('Token xác nhận không hợp lệ hoặc đã hết hạn');
    }

    return res.redirect(`${FRONTEND_URL}/dashboard?usageAlert=confirmed`);
  } catch (error) {
    console.error('Usage alert confirm error:', error);
    return res.status(500).send('Lỗi server, vui lòng thử lại');
  }
});

module.exports = router;
