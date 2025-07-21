-- 创建代码模板表
CREATE TABLE IF NOT EXISTS code_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    code_content TEXT NOT NULL,
    tags TEXT, -- JSON格式存储标签数组
    language TEXT NOT NULL DEFAULT 'python',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS code_template_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT, -- 标签颜色
    created_at TEXT NOT NULL
);

-- 创建模板和标签的关联表
CREATE TABLE IF NOT EXISTS code_template_tag_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (template_id) REFERENCES code_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES code_template_tags(id) ON DELETE CASCADE,
    UNIQUE(template_id, tag_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_code_templates_name ON code_templates(name);
CREATE INDEX IF NOT EXISTS idx_code_templates_language ON code_templates(language);
CREATE INDEX IF NOT EXISTS idx_code_template_tags_name ON code_template_tags(name);
CREATE INDEX IF NOT EXISTS idx_template_tag_relations_template ON code_template_tag_relations(template_id);
CREATE INDEX IF NOT EXISTS idx_template_tag_relations_tag ON code_template_tag_relations(tag_id);

-- 插入默认标签
INSERT OR IGNORE INTO code_template_tags (name, color, created_at)
VALUES 
    ('IoT消息', '#3b82f6', '2024-12-21T00:00:00Z'),
    ('数据处理', '#10b981', '2024-12-21T00:00:00Z'),
    ('工具函数', '#f59e0b', '2024-12-21T00:00:00Z'),
    ('测试代码', '#8b5cf6', '2024-12-21T00:00:00Z'),
    ('示例代码', '#ef4444', '2024-12-21T00:00:00Z');