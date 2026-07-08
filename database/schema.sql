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

CREATE TABLE IF NOT EXISTS transcriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  duration DOUBLE PRECISION,
  text TEXT NOT NULL DEFAULT '',
  words JSONB NOT NULL DEFAULT '[]',
  segments JSONB NOT NULL DEFAULT '[]',
  speaker_names JSONB NOT NULL DEFAULT '{}',
  audio_filename VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transcription_jobs (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assemblyai_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  filename VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  audio_filename VARCHAR(255) NOT NULL,
  speaker_labels BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  transcription_id INTEGER REFERENCES transcriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transcriptions_user_id_idx ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS transcription_jobs_user_id_idx ON transcription_jobs(user_id);
