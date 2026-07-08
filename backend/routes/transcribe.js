require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { AssemblyAI } = require('assemblyai');
const pool     = require('../db');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
const DAILY_USAGE_ALERT_SECONDS = 60 * 60; // 1 giờ

const ALLOWED_EXT = /\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm)$/i;
const MAX_SIZE_MB  = 200;
const FREE_TRANSCRIPTION_SECONDS = 30 * 60;
const PLAN_DAILY_LIMITS = {
  plus: 3 * 60 * 60,
  pro: 5 * 60 * 60,
  pre: 7 * 60 * 60,
};
const SUPPORTED_LANGUAGES = new Set([
  'auto', 'vi', 'en', 'en_us', 'en_uk', 'fr', 'de', 'es', 'it', 'pt',
  'nl', 'hi', 'ja', 'zh', 'fi', 'ko', 'pl', 'ru', 'tr', 'uk',
]);
let ensureUserQuotaColumnsPromise = null;

// Thư mục lưu file audio
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXT.test(file.originalname)) return cb(null, true);
    cb(new Error('Định dạng file không được hỗ trợ'));
  },
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

function ensureUserQuotaColumns() {
  if (!ensureUserQuotaColumnsPromise) {
    ensureUserQuotaColumnsPromise = pool.query(`
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
      ensureUserQuotaColumnsPromise = null;
      throw error;
    });
  }
  return ensureUserQuotaColumnsPromise;
}

function buildQuota(user) {
  const freeSeconds = Number(user.free_transcription_seconds ?? FREE_TRANSCRIPTION_SECONDS);
  const usedSeconds = Number(user.used_transcription_seconds ?? 0);
  const plan = user.plan ?? 'free';
  const paygSeconds = Number(user.payg_seconds_remaining ?? 0);
  const dailyLimit = PLAN_DAILY_LIMITS[plan] ?? null;
  const dailyUsed = user.is_daily_quota_today === false ? 0 : Number(user.daily_transcription_seconds ?? 0);
  const alertDailySeconds = user.is_usage_alert_today === false ? 0 : Number(user.usage_alert_daily_seconds ?? 0);

  return {
    plan,
    billingCycle: user.billing_cycle ?? null,
    freeTranscriptionSeconds: freeSeconds,
    usedTranscriptionSeconds: usedSeconds,
    paygSecondsRemaining: paygSeconds,
    dailyTranscriptionSeconds: dailyUsed,
    dailyQuotaSeconds: dailyLimit,
    usageAlertRequired: user.usage_alert_required ?? false,
    usageAlertDailySeconds: alertDailySeconds,
    usageAlertConfirmed: user.is_usage_alert_confirmed_today ?? false,
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

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function getMaxEndTime(items) {
  if (!Array.isArray(items)) return null;

  return items.reduce((maxEnd, item) => {
    const end = toPositiveNumber(item?.end);
    return end === null ? maxEnd : Math.max(maxEnd, end);
  }, 0) || null;
}

function getTranscriptDurationSeconds(transcript) {
  const audioDuration = toPositiveNumber(transcript?.audio_duration);
  if (audioDuration !== null) return audioDuration;

  const lastWordEnd = getMaxEndTime(transcript?.words);
  const lastUtteranceEnd = getMaxEndTime(transcript?.utterances);
  const lastTimestampMs = Math.max(lastWordEnd ?? 0, lastUtteranceEnd ?? 0);

  return lastTimestampMs > 0 ? lastTimestampMs / 1000 : null;
}

function getBillableTranscriptionSeconds(durationSeconds) {
  return Math.max(1, Math.ceil(toPositiveNumber(durationSeconds) ?? 0));
}

async function getUserQuota(userId) {
  const { rows } = await pool.query(
    `SELECT plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required, usage_alert_confirmed_at::date = CURRENT_DATE AS is_usage_alert_confirmed_today
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] ? buildQuota(rows[0]) : null;
}

async function consumeTranscriptionSeconds(userId, durationSeconds) {
  const seconds = getBillableTranscriptionSeconds(durationSeconds);
  const { rows } = await pool.query(
    `UPDATE users
     SET used_transcription_seconds = CASE WHEN plan = 'free' THEN used_transcription_seconds + $1 ELSE used_transcription_seconds END,
         payg_seconds_remaining = CASE WHEN plan = 'payg' THEN GREATEST(0, payg_seconds_remaining - $1) ELSE payg_seconds_remaining END,
         daily_transcription_seconds = CASE
           WHEN plan IN ('plus', 'pro', 'pre') AND daily_quota_date = CURRENT_DATE THEN daily_transcription_seconds + $1
           WHEN plan IN ('plus', 'pro', 'pre') THEN $1
           ELSE daily_transcription_seconds
         END,
         daily_quota_date = CASE WHEN plan IN ('plus', 'pro', 'pre') THEN CURRENT_DATE ELSE daily_quota_date END,
         usage_alert_daily_seconds = CASE
           WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_daily_seconds + $1
           ELSE $1
         END,
         usage_alert_date = CURRENT_DATE,
         usage_alert_required = CASE
           WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_required
           ELSE FALSE
         END,
         usage_alert_token = CASE
           WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_token
           ELSE NULL
         END,
         usage_alert_confirmed_at = CASE
           WHEN usage_alert_date = CURRENT_DATE THEN usage_alert_confirmed_at
           ELSE NULL
         END
     WHERE id = $2
     RETURNING plan, billing_cycle, free_transcription_seconds, used_transcription_seconds, payg_seconds_remaining, daily_transcription_seconds, daily_quota_date = CURRENT_DATE AS is_daily_quota_today, usage_alert_daily_seconds, usage_alert_date = CURRENT_DATE AS is_usage_alert_today, usage_alert_required, usage_alert_confirmed_at::date = CURRENT_DATE AS is_usage_alert_confirmed_today`,
    [seconds, userId]
  );

  return buildQuota(rows[0]);
}

function getQuotaLimitMessage(quota) {
  if (quota.plan === 'free') {
    return 'Bạn đã dùng hết 30 phút chuyển đổi miễn phí. Vui lòng nâng cấp tài khoản để tiếp tục.';
  }
  if (quota.plan === 'payg') {
    return 'Bạn đã dùng hết số giờ Pay As You Go đã mua. Vui lòng mua thêm giờ hoặc nâng cấp gói tháng/năm.';
  }
  return 'Bạn đã dùng hết thời gian chuyển đổi hôm nay. Vui lòng quay lại ngày mai hoặc nâng cấp gói cao hơn.';
}

function getOverLimitMessage(quota) {
  const minutes = Math.floor(quota.remainingTranscriptionSeconds / 60);
  const seconds = quota.remainingTranscriptionSeconds % 60;
  if (quota.plan === 'free') {
    return `File dài hơn thời gian miễn phí còn lại (${minutes} phút ${seconds} giây). Vui lòng nâng cấp tài khoản để tiếp tục.`;
  }
  if (quota.plan === 'payg') {
    return `File dài hơn số giờ Pay As You Go còn lại (${minutes} phút ${seconds} giây). Vui lòng mua thêm giờ.`;
  }
  return `File dài hơn thời gian chuyển đổi còn lại hôm nay (${minutes} phút ${seconds} giây). Vui lòng nâng cấp gói cao hơn hoặc quay lại ngày mai.`;
}

async function sendUsageAlertEmail(email, confirmUrl) {
  if (
    nodemailer &&
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Xác nhận tiếp tục chuyển đổi sau 1 giờ sử dụng hôm nay',
      text: `Bạn đã dùng hơn 1 giờ chuyển đổi trong hôm nay. Bấm link này để xác nhận tiếp tục sử dụng: ${confirmUrl}`,
      html: `
        <p>Bạn đã dùng hơn <strong>1 giờ chuyển đổi</strong> trong hôm nay.</p>
        <p>Nếu đúng là bạn đang sử dụng, hãy bấm link bên dưới để tiếp tục chuyển đổi:</p>
        <p><a href="${confirmUrl}">Xác nhận tiếp tục sử dụng</a></p>
      `,
    });
    return;
  }

  console.warn(`Usage alert email fallback for ${email}: ${confirmUrl}`);
}

async function issueUsageAlert(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `UPDATE users
     SET usage_alert_required = TRUE,
         usage_alert_token = $1,
         usage_alert_sent_at = NOW()
     WHERE id = $2
     RETURNING email`,
    [token, userId]
  );

  const email = rows[0]?.email;
  if (!email) return null;

  const confirmUrl = `${BACKEND_URL}/api/auth/usage-alert/confirm?token=${token}`;
  await sendUsageAlertEmail(email, confirmUrl);
  return confirmUrl;
}

// POST /api/transcribe — nhận file âm thanh, gọi AssemblyAI, trả về văn bản
router.post('/', authMiddleware, (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File quá lớn (tối đa ${MAX_SIZE_MB}MB)` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  let savedAudioFilename = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file âm thanh' });
    }
    if (!process.env.ASSEMBLYAI_API_KEY) {
      return res.status(503).json({ error: 'Chưa cấu hình ASSEMBLYAI_API_KEY trong backend/.env' });
    }

    await ensureUserQuotaColumns();
    const quotaBefore = await getUserQuota(req.user.id);
    if (!quotaBefore) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    if (
      quotaBefore.usageAlertDailySeconds >= DAILY_USAGE_ALERT_SECONDS &&
      !quotaBefore.usageAlertConfirmed
    ) {
      const confirmUrl = await issueUsageAlert(req.user.id);
      return res.status(403).json({
        error: 'Bạn đã dùng quá 1 giờ chuyển đổi trong hôm nay. Vui lòng xác nhận qua email để tiếp tục sử dụng.',
        usageAlert: {
          required: true,
          emailSent: Boolean(confirmUrl),
        },
      });
    }
    if (quotaBefore.remainingTranscriptionSeconds !== null && quotaBefore.remainingTranscriptionSeconds <= 0) {
      return res.status(402).json({
        error: getQuotaLimitMessage(quotaBefore),
        quota: quotaBefore,
      });
    }

    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

    const speakerLabels = req.body.speakerLabels === 'true';
    const language = typeof req.body.language === 'string' ? req.body.language : 'auto';
    if (!SUPPORTED_LANGUAGES.has(language)) {
      return res.status(400).json({ error: 'Ngôn ngữ không được hỗ trợ' });
    }

    const transcriptOptions = {
      audio:              req.file.buffer,
      speaker_labels:     speakerLabels,
    };
    if (language === 'auto') transcriptOptions.language_detection = true;
    else transcriptOptions.language_code = language;

    const transcript = await client.transcripts.transcribe(transcriptOptions);

    if (transcript.status === 'error') {
      return res.status(500).json({ error: transcript.error ?? 'AssemblyAI trả về lỗi' });
    }

    let text;
    if (speakerLabels && transcript.utterances?.length > 0) {
      text = transcript.utterances
        .map((u) => `Người nói ${u.speaker}: ${u.text}`)
        .join('\n\n');
    } else {
      text = transcript.text ?? '';
    }
    const duration = getTranscriptDurationSeconds(transcript);
    const billableSeconds = getBillableTranscriptionSeconds(duration);
    if (
      quotaBefore.remainingTranscriptionSeconds !== null &&
      billableSeconds > quotaBefore.remainingTranscriptionSeconds
    ) {
      return res.status(402).json({
        error: getOverLimitMessage(quotaBefore),
        quota: quotaBefore,
      });
    }

    // multer đọc tên file dưới dạng latin1, cần re-encode sang utf-8
    const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Lưu file audio lên disk để phát lại từ lịch sử
    const ext = (req.file.originalname.match(/\.([^.]+)$/) || ['', 'audio'])[1].toLowerCase();
    savedAudioFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, savedAudioFilename), req.file.buffer);

    // Lưu lịch sử vào DB
    await pool.query(
      `INSERT INTO transcriptions (user_id, filename, file_size, duration, text, words, audio_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.id, filename, req.file.size, duration, text,
       JSON.stringify(transcript.words ?? []), savedAudioFilename]
    );

    const quota = await consumeTranscriptionSeconds(req.user.id, billableSeconds);

    return res.json({ text, duration, filename: req.file.originalname, words: transcript.words ?? [], quota });
  } catch (err) {
    // Dọn file nếu lưu DB thất bại
    if (savedAudioFilename) {
      fs.unlink(path.join(UPLOADS_DIR, savedAudioFilename), () => {});
    }
    console.error('Transcribe error:', err);
    const msg = err?.response?.data?.error || err?.message || 'Lỗi khi chuyển đổi âm thanh';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/transcribe/history — lịch sử chuyển đổi của user
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, filename, file_size, duration, text, words, audio_filename, created_at
       FROM transcriptions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// GET /api/transcribe/:id/audio — phục vụ file audio (có xác thực)
router.get('/:id/audio', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });
  try {
    const { rows } = await pool.query(
      'SELECT audio_filename FROM transcriptions WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!rows[0]?.audio_filename) return res.status(404).json({ error: 'Không có file audio' });
    const filePath = path.join(UPLOADS_DIR, rows[0].audio_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File audio không tồn tại trên server' });
    res.sendFile(filePath);
  } catch {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// PATCH /api/transcribe/:id — cập nhật nội dung văn bản
router.patch('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'Thiếu trường text' });
  try {
    const { rowCount, rows } = await pool.query(
      'UPDATE transcriptions SET text = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [text, id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    return res.json(rows[0]);
  } catch {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// DELETE /api/transcribe/:id — xóa bản ghi và file audio
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });
  try {
    // Lấy audio_filename trước khi xóa
    const { rows } = await pool.query(
      'SELECT audio_filename FROM transcriptions WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    const { rowCount } = await pool.query(
      'DELETE FROM transcriptions WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    // Xóa file audio trên disk
    if (rows[0]?.audio_filename) {
      fs.unlink(path.join(UPLOADS_DIR, rows[0].audio_filename), () => {});
    }
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
