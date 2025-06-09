-- 为message_tests表添加备注字段
ALTER TABLE message_tests ADD COLUMN notes TEXT;

-- 为accuracy_tests表添加备注字段  
ALTER TABLE accuracy_tests ADD COLUMN notes TEXT;

-- 创建索引以支持备注搜索
CREATE INDEX IF NOT EXISTS idx_message_tests_notes ON message_tests(notes);
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_notes ON accuracy_tests(notes);