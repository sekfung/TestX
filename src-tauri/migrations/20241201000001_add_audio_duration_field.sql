-- 添加音频时长字段
ALTER TABLE accuracy_tests ADD COLUMN audio_duration INTEGER; -- 音频时长（毫秒）