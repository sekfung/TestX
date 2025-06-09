-- 为准确性测试表添加测试模式相关字段
ALTER TABLE accuracy_tests ADD COLUMN test_mode TEXT NOT NULL DEFAULT 'manual'; -- manual, loop, timed
ALTER TABLE accuracy_tests ADD COLUMN loop_count INTEGER; -- 循环次数（循环模式使用）
ALTER TABLE accuracy_tests ADD COLUMN scheduled_time TEXT; -- 定时录音时间（定时模式使用）
ALTER TABLE accuracy_tests ADD COLUMN current_loop INTEGER DEFAULT 0; -- 当前循环次数
ALTER TABLE accuracy_tests ADD COLUMN auto_executed BOOLEAN DEFAULT FALSE; -- 是否自动执行代码

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_test_mode ON accuracy_tests(test_mode);
CREATE INDEX IF NOT EXISTS idx_accuracy_tests_scheduled_time ON accuracy_tests(scheduled_time);