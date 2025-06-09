-- Add user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preference_type VARCHAR(100) NOT NULL UNIQUE,
    preference_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create index for faster preference lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(preference_type); 