-- 创建配置表
CREATE TABLE IF NOT EXISTS configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_type TEXT NOT NULL UNIQUE, -- 'speech', 'iot', 'recognition', 'hotword'
    config_data TEXT NOT NULL, -- JSON格式的配置数据（加密）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_configs_type ON configs(config_type); 