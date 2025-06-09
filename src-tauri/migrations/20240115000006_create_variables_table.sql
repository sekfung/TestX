-- 创建变量管理表
CREATE TABLE IF NOT EXISTS variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 插入默认变量
INSERT OR IGNORE INTO variables (name, value, description, is_default, created_at, updated_at)
VALUES 
    ('PRODUCT_KEY', '', '阿里云IoT产品密钥', 1, '2024-01-15T00:00:00Z', '2024-01-15T00:00:00Z'),
    ('DEVICE_NAME', '', '设备名称', 1, '2024-01-15T00:00:00Z', '2024-01-15T00:00:00Z');

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(name); 