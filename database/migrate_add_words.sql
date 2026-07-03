-- Migration: thêm cột words (word-level timestamps từ AssemblyAI) vào bảng transcriptions
ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS words JSONB DEFAULT '[]';

-- Backfill các bản ghi cũ chưa có words
UPDATE transcriptions SET words = '[]' WHERE words IS NULL;
