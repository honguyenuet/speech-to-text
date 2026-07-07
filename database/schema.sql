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
  plan        VARCHAR(50) NOT NULL DEFAULT 'free',
  billing_cycle VARCHAR(20),
  free_transcription_seconds INTEGER NOT NULL DEFAULT 1800,
  used_transcription_seconds INTEGER NOT NULL DEFAULT 0,
  payg_seconds_remaining INTEGER NOT NULL DEFAULT 0,
  daily_transcription_seconds INTEGER NOT NULL DEFAULT 0,
  daily_quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_alert_daily_seconds INTEGER NOT NULL DEFAULT 0,
  usage_alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_alert_required BOOLEAN NOT NULL DEFAULT FALSE,
  usage_alert_token VARCHAR(255),
  usage_alert_sent_at TIMESTAMP WITH TIME ZONE,
  usage_alert_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
