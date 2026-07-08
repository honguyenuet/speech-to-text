ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT '[]';
ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS speaker_names JSONB DEFAULT '{}';
UPDATE transcriptions SET segments = '[]' WHERE segments IS NULL;
UPDATE transcriptions SET speaker_names = '{}' WHERE speaker_names IS NULL;

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
  transcription_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transcription_jobs_user_id_idx ON transcription_jobs(user_id);
