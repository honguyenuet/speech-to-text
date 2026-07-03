-- Thêm cột avatar cho bảng users (chạy 1 lần)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
