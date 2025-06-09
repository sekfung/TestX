use tauri::{State, Manager};
use crate::database::Variable;
use crate::iot_message::DatabaseState;
use std::path::PathBuf;

#[tauri::command]
pub async fn get_all_variables(
    db_state: State<'_, DatabaseState>,
) -> Result<Vec<Variable>, String> {
    let db_guard = db_state.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.get_all_variables().await.map_err(|e| format!("获取变量列表失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn create_variable(
    name: String,
    value: String,
    description: Option<String>,
    db_state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let db_guard = db_state.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.create_variable(&name, &value, description.as_deref()).await
            .map_err(|e| format!("创建变量失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn update_variable(
    id: i64,
    name: String,
    value: String,
    description: Option<String>,
    db_state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let db_guard = db_state.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_variable(id, &name, &value, description.as_deref()).await
            .map_err(|e| format!("更新变量失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn delete_variable(
    id: i64,
    db_state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let db_guard = db_state.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.delete_variable(id).await
            .map_err(|e| format!("删除变量失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn get_variable_by_name(
    name: String,
    db_state: State<'_, DatabaseState>,
) -> Result<Option<Variable>, String> {
    let db_guard = db_state.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.get_variable_by_name(&name).await
            .map_err(|e| format!("获取变量失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[tauri::command]
pub async fn initialize_database(
    app_handle: tauri::AppHandle,
    db_state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut db_guard = db_state.0.lock().await;
    if db_guard.is_none() {
        let app_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
        let db = crate::database::Database::new(app_dir.join("testx.db")).await.map_err(|e| format!("初始化数据库失败: {}", e))?;
        *db_guard = Some(db);
        Ok(())
    } else {
        Err("数据库已经初始化".to_string())
    }
} 