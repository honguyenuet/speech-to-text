-- Tạo database (chạy lệnh này với quyền superuser PostgreSQL)
-- CREATE DATABASE golden_voice;

-- Kết nối vào golden_voice, sau đó chạy phần còn lại:

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  google_id   VARCHAR(255) UNIQUE,
  first_name  VARCHAR(255) NOT NULL,
  last_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
