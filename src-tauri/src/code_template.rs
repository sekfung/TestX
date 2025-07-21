use crate::database::{CodeTemplateWithTags, CodeTemplateTag};
use crate::iot_message::DatabaseState;
use serde::{Deserialize, Serialize};
use tauri::State;
use log::info;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub code_content: String,
    pub language: String,
    pub tag_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchTemplateRequest {
    pub query: Option<String>,
    pub language: Option<String>,
    pub tag_names: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
    pub color: Option<String>,
}

// 保存代码模板
#[tauri::command]
pub async fn save_code_template(
    database: State<'_, DatabaseState>,
    request: CreateTemplateRequest,
) -> Result<i64, String> {
    info!("保存代码模板: {}", request.name);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.save_code_template(
            &request.name,
            request.description.as_deref(),
            &request.code_content,
            &request.language,
            &request.tag_ids,
        )
        .await
        .map_err(|e| format!("保存代码模板失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 获取代码模板列表
#[tauri::command]
pub async fn get_code_templates(
    database: State<'_, DatabaseState>,
    language: Option<String>,
) -> Result<Vec<CodeTemplateWithTags>, String> {
    info!("获取代码模板列表, 语言: {:?}", language);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.get_code_templates(language.as_deref())
            .await
            .map_err(|e| format!("获取代码模板失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 搜索代码模板
#[tauri::command]
pub async fn search_code_templates(
    database: State<'_, DatabaseState>,
    query: Option<String>,
    language: Option<String>,
    tag_names: Vec<String>,
) -> Result<Vec<CodeTemplateWithTags>, String> {
    info!("搜索代码模板: query={:?}, language={:?}, tag_names={:?}", query, language, tag_names);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        let search_query = query.unwrap_or_default();
        db.search_code_templates(&search_query, language.as_deref(), &tag_names)
            .await
            .map_err(|e| format!("搜索代码模板失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 删除代码模板
#[tauri::command]
pub async fn delete_code_template(
    database: State<'_, DatabaseState>,
    id: i64,
) -> Result<(), String> {
    info!("删除代码模板: {}", id);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.delete_code_template(id)
            .await
            .map_err(|e| format!("删除代码模板失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 创建标签
#[tauri::command]
pub async fn create_code_template_tag(
    database: State<'_, DatabaseState>,
    request: CreateTagRequest,
) -> Result<i64, String> {
    info!("创建代码模板标签: {}", request.name);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.create_tag(&request.name, request.color.as_deref())
            .await
            .map_err(|e| format!("创建标签失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 获取所有标签
#[tauri::command]
pub async fn get_all_code_template_tags(
    database: State<'_, DatabaseState>,
) -> Result<Vec<CodeTemplateTag>, String> {
    info!("获取所有代码模板标签");
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.get_all_tags()
            .await
            .map_err(|e| format!("获取标签失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 搜索标签
#[tauri::command]
pub async fn search_code_template_tags(
    database: State<'_, DatabaseState>,
    query: String,
) -> Result<Vec<CodeTemplateTag>, String> {
    info!("搜索代码模板标签: {}", query);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.search_tags(&query)
            .await
            .map_err(|e| format!("搜索标签失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 删除标签
#[tauri::command]
pub async fn delete_code_template_tag(
    database: State<'_, DatabaseState>,
    id: i64,
) -> Result<(), String> {
    info!("删除代码模板标签: {}", id);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.delete_tag(id)
            .await
            .map_err(|e| format!("删除标签失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 更新标签
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTagRequest {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn update_code_template_tag(
    database: State<'_, DatabaseState>,
    request: UpdateTagRequest,
) -> Result<(), String> {
    info!("更新代码模板标签: {} -> {}", request.id, request.name);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_tag(request.id, &request.name, request.color.as_deref())
            .await
            .map_err(|e| format!("更新标签失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 更新代码模板
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTemplateRequest {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub code_content: String,
    pub language: String,
    pub tag_ids: Vec<i64>,
}

#[tauri::command]
pub async fn update_code_template(
    database: State<'_, DatabaseState>,
    request: UpdateTemplateRequest,
) -> Result<(), String> {
    info!("更新代码模板: {} -> {}", request.id, request.name);
    
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_code_template(
            request.id,
            &request.name,
            request.description.as_deref(),
            &request.code_content,
            &request.language,
            &request.tag_ids,
        )
        .await
        .map_err(|e| format!("更新代码模板失败: {}", e))
    } else {
        Err("数据库未初始化".to_string())
    }
}