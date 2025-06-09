use tauri::State;
use crate::iot_message::DatabaseState;

#[tauri::command]
pub async fn save_user_preference(
    database: State<'_, DatabaseState>,
    preference_type: String,
    preference_data: String,
) -> Result<(), String> {
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.save_user_preference(&preference_type, &preference_data)
            .await
            .map_err(|e| format!("保存用户偏好设置失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn load_user_preference(
    database: State<'_, DatabaseState>,
    preference_type: String,
) -> Result<Option<String>, String> {
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.load_user_preference(&preference_type)
            .await
            .map_err(|e| format!("加载用户偏好设置失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
} 