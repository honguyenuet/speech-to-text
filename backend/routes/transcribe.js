require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const fs       = require('fs');
const { AssemblyAI } = require('assemblyai');
const pool     = require('../db');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

const ALLOWED_EXT = /\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm)$/i;
const MAX_SIZE_MB  = 200;

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

    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

    const speakerLabels = req.body.speakerLabels === 'true';

    const transcript = await client.transcripts.transcribe({
      audio:              req.file.buffer,
      language_detection: true,
      speaker_labels:     speakerLabels,
    });

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
    const duration = transcript.audio_duration ?? null;

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

    return res.json({ text, duration, filename: req.file.originalname, words: transcript.words ?? [] });
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
