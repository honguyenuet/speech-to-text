require('dotenv').config();
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

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
      `INSERT INTO users (first_name, last_name, email, password, google_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, email`,
      [firstName, lastName, email, hashedPassword, googleId || null]
    );

    const user = rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// GET /api/auth/me — lấy thông tin user hiện tại qua JWT
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, email, avatar FROM users WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = rows[0];
    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  } catch (error) {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

// PATCH /api/auth/profile — cập nhật họ tên
router.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ và tên' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2
       WHERE id = $3
       RETURNING id, first_name, last_name, email, avatar`,
      [firstName.trim(), lastName.trim(), decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = rows[0];
    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

// POST /api/auth/avatar — cập nhật ảnh đại diện (base64 data URL)
router.post('/avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

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
       RETURNING id, first_name, last_name, email, avatar`,
      [avatar, decoded.id]
    );

    const user = rows[0];
    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
});

module.exports = router;
