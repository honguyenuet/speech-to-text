-- Migration: lưu tên file audio trên disk để phát lại từ lịch sử
ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS audio_filename VARCHAR(255);
