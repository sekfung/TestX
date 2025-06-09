-- 为message_tests表添加新字段
ALTER TABLE message_tests ADD COLUMN product_key TEXT;
ALTER TABLE message_tests ADD COLUMN device_name TEXT;
ALTER TABLE message_tests ADD COLUMN mode TEXT NOT NULL DEFAULT 'form';
ALTER TABLE message_tests ADD COLUMN python_code TEXT;