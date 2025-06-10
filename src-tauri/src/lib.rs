// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::fs;
use dirs;

// 这个文件主要用于移动端入口点
// 桌面端使用 main.rs

pub mod speech;
pub mod config;
pub mod iot_message;
pub mod python_executor;
pub mod database;
pub mod accuracy_test;
pub mod audio_api;
pub mod audio_file_manager;
pub mod audio_processor;
pub mod logger;
pub mod serial_port;
pub mod user_preferences;
pub mod variable_manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_text_file(path: String, content: String) -> Result<(), String> {
    // 处理 ~ 路径展开
    let expanded_path = if path.starts_with("~/") {
        match dirs::home_dir() {
            Some(home) => home.join(&path[2..]),
            None => return Err("无法获取用户主目录".to_string()),
        }
    } else {
        std::path::PathBuf::from(&path)
    };
    
    // 确保目录存在
    if let Some(parent) = expanded_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    // 写入文件
    fs::write(&expanded_path, content).map_err(|e| format!("写入文件失败: {}", e))?;
    
    log::info!("成功保存文件到: {:?}", expanded_path);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 移动端配置可以在这里添加
    // 目前使用 main.rs 作为主要入口点
}
