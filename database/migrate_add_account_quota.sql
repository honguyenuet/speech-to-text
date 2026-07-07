-- Migration: them thong tin goi tai khoan va quota chuyen doi mien phi
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
