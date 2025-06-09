-- Create message_tests table
CREATE TABLE IF NOT EXISTS message_tests (
    id TEXT PRIMARY KEY NOT NULL,
    topic TEXT NOT NULL,
    qos_level INTEGER NOT NULL CHECK (qos_level IN (0, 1, 2)),
    payload TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TEXT,
    response TEXT,
    created_at TEXT NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_message_tests_created_at ON message_tests(created_at);
CREATE INDEX IF NOT EXISTS idx_message_tests_status ON message_tests(status); 