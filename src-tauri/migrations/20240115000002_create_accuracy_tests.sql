-- 创建准确性测试表
CREATE TABLE IF NOT EXISTS accuracy_tests (
    id TEXT PRIMARY KEY,
    expected_text TEXT NOT NULL,
    recognized_text TEXT,
    similarity REAL,
    result TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    completed_at TEXT,
    audio_file_path TEXT,
    python_code TEXT,
    mode TEXT NOT NULL DEFAULT 'form',
    error_message TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_created_at ON accuracy_tests(created_at);
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_result ON accuracy_tests(result);
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_mode ON accuracy_tests(mode); 