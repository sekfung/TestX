-- 为accuracy_tests表添加audio_data字段
-- 用于存储录音的Base64编码数据

ALTER TABLE accuracy_tests ADD COLUMN audio_data TEXT;