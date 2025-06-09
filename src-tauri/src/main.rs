// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod speech;
mod config;
mod iot_message;
mod python_executor;
mod database;
mod accuracy_test;
mod variable_manager;
mod user_preferences;
mod audio_processor;
mod logger;
mod serial_port;

use speech::recognize_speech;
use config::{save_speech_config, save_iot_config, load_speech_config, load_iot_config, delete_config, save_recognition_config, load_recognition_config, save_hotword_config, load_hotword_config, check_config_status};
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;
use iot_message::{send_iot_message, send_iot_message_with_precomputed_params, get_message_tests, delete_message_test, get_message_test_by_id, retest_message, DatabaseState};
use python_executor::{PythonExecutionResult, PYTHON_TEMPLATE, send_iot_message_from_python};
use accuracy_test::{create_accuracy_test, get_accuracy_tests, delete_accuracy_test, execute_accuracy_test_python_code, perform_speech_recognition, get_accuracy_test_python_template, execute_accuracy_test_with_message, execute_accuracy_test_with_params, execute_accuracy_test_with_params_precomputed, create_timed_recording_task};
use database::Database;
use tauri::{Emitter, Manager, State};
use serde_json;
use log::{Log, Metadata, Record, Level};
use std::fs;
use std::sync::Mutex;
use std::path::PathBuf;
use crate::variable_manager::{get_all_variables, create_variable, update_variable, delete_variable, get_variable_by_name, initialize_database};
use crate::user_preferences::{save_user_preference, load_user_preference};
use crate::serial_port::{scan_serial_ports, connect_serial_port, disconnect_serial_port, is_serial_port_connected};

#[derive(Clone)]
struct FrontendLogger {
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

impl FrontendLogger {
    fn new() -> Self {
        Self {
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    fn set_app_handle(&self, handle: tauri::AppHandle) {
        if let Ok(mut app_handle) = self.app_handle.lock() {
            *app_handle = Some(handle);
        }
    }
}

impl Log for FrontendLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Debug
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            println!("[{}] [{}] {}", 
                record.level(), 
                record.target(), 
                record.args()
            );

            if let Ok(app_handle_guard) = self.app_handle.lock() {
                if let Some(ref app_handle) = *app_handle_guard {
                    let frontend_level = match record.level() {
                        Level::Error => "error",
                        Level::Warn => "warn", 
                        Level::Info => "info",
                        Level::Debug => "debug",
                        Level::Trace => "debug",
                    };

                    let source = if record.target().contains("tencentcloud_speech") {
                        "TencentCloud"
                    } else if record.target().contains("aliyun_iot_rust_sdk") {
                        "AliyunIoT"
                    } else if record.target().contains("testx::speech") {
                        "Speech"
                    } else if record.target().contains("testx::config") {
                        "Config"
                    } else if record.target().contains("testx::iot_message") {
                        "IoT"
                    } else if record.target().contains("testx::accuracy_test") {
                        "AccuracyTest"
                    } else if record.target().contains("testx::python_executor") {
                        "Python"
                    } else if record.target().contains("testx") {
                        "System"
                    } else {
                        record.target()
                    };

                    send_log_to_frontend_direct(app_handle, frontend_level, &record.args().to_string(), source);
                }
            }
        }
    }

    fn flush(&self) {}
}

// 直接发送日志到前端的函数（避免循环调用）
fn send_log_to_frontend_direct(app_handle: &tauri::AppHandle, level: &str, message: &str, source: &str) {
    let log_entry = serde_json::json!({
        "level": level,
        "type": "software",
        "message": message,
        "source": source
    });
    
    if let Err(e) = app_handle.emit("rust-log", &log_entry) {
        eprintln!("❌ 日志事件发送失败: {}", e);
    }
}

// 日志发送助手函数（保持兼容性）
pub fn send_log_to_frontend(app_handle: &tauri::AppHandle, level: &str, message: &str, source: &str) {
    send_log_to_frontend_direct(app_handle, level, message, source);
}

#[tauri::command]
async fn save_text_file(app_handle: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    send_log_to_frontend(&app_handle, "info", &format!("开始保存文件到: {}", path), "FileSystem");
    
    // 处理 ~ 路径展开
    let expanded_path = if path.starts_with("~/") {
        match dirs::home_dir() {
            Some(home) => home.join(&path[2..]),
            None => {
                let error_msg = "无法获取用户主目录";
                send_log_to_frontend(&app_handle, "error", error_msg, "FileSystem");
                return Err(error_msg.to_string());
            }
        }
    } else {
        std::path::PathBuf::from(&path)
    };
    
    send_log_to_frontend(&app_handle, "debug", &format!("展开后的路径: {:?}", expanded_path), "FileSystem");
    
    // 确保目录存在
    if let Some(parent) = expanded_path.parent() {
        if !parent.exists() {
            send_log_to_frontend(&app_handle, "info", &format!("创建目录: {:?}", parent), "FileSystem");
            if let Err(e) = fs::create_dir_all(parent) {
                let error_msg = format!("创建目录失败: {}", e);
                send_log_to_frontend(&app_handle, "error", &error_msg, "FileSystem");
                return Err(error_msg);
            }
        }
    }
    
    // 写入文件
    if let Err(e) = fs::write(&expanded_path, content) {
        let error_msg = format!("写入文件失败: {}", e);
        send_log_to_frontend(&app_handle, "error", &error_msg, "FileSystem");
        return Err(error_msg);
    }
    
    let success_msg = format!("成功保存文件到: {:?}", expanded_path);
    send_log_to_frontend(&app_handle, "info", &success_msg, "FileSystem");
    log::info!("{}", success_msg);
    Ok(())
}

#[tauri::command]
fn greet(app_handle: tauri::AppHandle, name: &str) -> String {
    let message = format!("Hello, {}! You've been greeted from Rust!", name);
    send_log_to_frontend(&app_handle, "info", &format!("执行greet命令，参数: {}", name), "Command");
    message
}

// Python相关的Tauri命令
#[tauri::command]
async fn execute_python_code_command(app_handle: tauri::AppHandle, code: String) -> Result<PythonExecutionResult, String> {
    send_log_to_frontend(&app_handle, "info", "开始执行Python代码（支持变量替换）", "Python");
    
    let result = python_executor::execute_python_code_async(&app_handle, &code).await;
    
    if result.success {
        send_log_to_frontend(&app_handle, "info", "Python代码执行成功", "Python");
    } else {
        send_log_to_frontend(&app_handle, "error", &format!("Python代码执行失败: {}", result.error.as_ref().unwrap_or(&"Unknown error".to_string())), "Python");
    }
    
    Ok(result)
}

// 异步Python执行命令（支持变量替换）
#[tauri::command]
async fn execute_python_code_with_variables(app_handle: tauri::AppHandle, code: String) -> Result<PythonExecutionResult, String> {
    send_log_to_frontend(&app_handle, "info", "开始执行Python代码（支持变量替换）", "Python");
    
    let result = python_executor::execute_python_code_async(&app_handle, &code).await;
    
    if result.success {
        send_log_to_frontend(&app_handle, "info", "Python代码执行成功", "Python");
    } else {
        send_log_to_frontend(&app_handle, "error", &format!("Python代码执行失败: {}", result.error.as_ref().unwrap_or(&"Unknown error".to_string())), "Python");
    }
    
    Ok(result)
}

#[tauri::command] 
fn get_python_template() -> String {
    PYTHON_TEMPLATE.to_string()
}

// 数据迁移功能
async fn migrate_data_if_needed(app_handle: &tauri::AppHandle) -> Result<(), String> {
    send_log_to_frontend(app_handle, "info", "检查是否需要数据迁移", "Migration");
    
    // 获取新的数据目录
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    let new_db_path = app_data_dir.join("testx.db");
    
    // 检查旧的数据库位置（可能在应用目录中）
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("获取当前目录失败: {}", e))?;
    
    let old_db_paths = vec![
        current_dir.join("testx.db"),
        current_dir.join("message_tests.db"), // 兼容旧名称
        current_dir.join("db").join("testx.db"),
        current_dir.join("db").join("message_tests.db"),
        current_dir.join("data").join("testx.db"),
        current_dir.join("data").join("message_tests.db"),
    ];
    
    // 检查是否存在旧的数据库文件需要迁移
    for old_path in old_db_paths {
        if old_path.exists() && old_path != new_db_path {
            send_log_to_frontend(app_handle, "info", &format!("发现旧数据库文件: {:?}", old_path), "Migration");
            
            // 确保新目录存在
            if let Some(parent) = new_db_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("创建新数据目录失败: {}", e))?;
                }
            }
            
            // 如果新位置没有数据库文件，则迁移旧的
            if !new_db_path.exists() {
                send_log_to_frontend(app_handle, "info", "开始迁移数据库文件", "Migration");
                
                fs::copy(&old_path, &new_db_path)
                    .map_err(|e| format!("迁移数据库文件失败: {}", e))?;
                
                send_log_to_frontend(app_handle, "info", "数据库文件迁移成功", "Migration");
                
                // 可选：删除旧文件（谨慎操作）
                if let Err(e) = fs::remove_file(&old_path) {
                    send_log_to_frontend(app_handle, "warn", &format!("删除旧数据库文件失败: {}", e), "Migration");
                } else {
                    send_log_to_frontend(app_handle, "info", "旧数据库文件已清理", "Migration");
                }
            } else {
                send_log_to_frontend(app_handle, "info", "新位置已有数据库文件，跳过迁移", "Migration");
            }
            break;
        }
    }
    
    Ok(())
}

// 数据备份功能
async fn backup_database_if_needed(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    let db_path = app_data_dir.join("testx.db");
    
    if db_path.exists() {
        let backup_dir = app_data_dir.join("backups");
        if !backup_dir.exists() {
            fs::create_dir_all(&backup_dir)
                .map_err(|e| format!("创建备份目录失败: {}", e))?;
        }
        
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_path = backup_dir.join(format!("testx_backup_{}.db", timestamp));
        
        // 只保留最近的5个备份文件
        if let Ok(entries) = fs::read_dir(&backup_dir) {
            let mut backup_files: Vec<_> = entries
                .filter_map(|entry| entry.ok())
                .filter(|entry| {
                    entry.file_name()
                        .to_string_lossy()
                        .starts_with("testx_backup_")
                })
                .collect();
            
            backup_files.sort_by(|a, b| {
                b.metadata().unwrap().modified().unwrap()
                    .cmp(&a.metadata().unwrap().modified().unwrap())
            });
            
            // 删除多余的备份文件
            for old_backup in backup_files.iter().skip(4) {
                if let Err(e) = fs::remove_file(old_backup.path()) {
                    send_log_to_frontend(app_handle, "warn", &format!("删除旧备份失败: {}", e), "Backup");
                }
            }
        }
        
        // 创建新备份
        if let Err(e) = fs::copy(&db_path, &backup_path) {
            send_log_to_frontend(app_handle, "warn", &format!("创建数据库备份失败: {}", e), "Backup");
        } else {
            send_log_to_frontend(app_handle, "info", &format!("数据库备份已创建: {:?}", backup_path), "Backup");
        }
    }
    
    Ok(())
}

// 获取数据库路径的统一函数
fn get_database_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    // 确保应用数据目录存在
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    }
    
    Ok(app_data_dir.join("testx.db"))
}

// 检查存储空间
fn check_storage_space(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        match fs2::available_space(parent) {
            Ok(available) => {
                let required = 50 * 1024 * 1024; // 50MB
                if available < required {
                    return Err(format!("存储空间不足，需要至少50MB，可用空间: {}MB", available / 1024 / 1024));
                }
            }
            Err(e) => {
                // 警告但不阻止启动
                eprintln!("⚠️ 无法检查存储空间: {}", e);
            }
        }
    }
    Ok(())
}

// 数据导出命令
#[tauri::command]
async fn export_data(app_handle: tauri::AppHandle, export_path: String) -> Result<String, String> {
    send_log_to_frontend(&app_handle, "info", "开始导出数据", "Export");
    
    let db_path = get_database_path(&app_handle)?;
    
    if !db_path.exists() {
        return Err("数据库文件不存在".to_string());
    }
    
    // 展开用户路径
    let expanded_path = if export_path.starts_with("~/") {
        match dirs::home_dir() {
            Some(home) => home.join(&export_path[2..]),
            None => return Err("无法获取用户主目录".to_string()),
        }
    } else {
        PathBuf::from(&export_path)
    };
    
    // 确保导出目录存在
    if let Some(parent) = expanded_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建导出目录失败: {}", e))?;
        }
    }
    
    // 复制数据库文件
    fs::copy(&db_path, &expanded_path)
        .map_err(|e| format!("导出数据失败: {}", e))?;
    
    let success_msg = format!("数据已成功导出到: {:?}", expanded_path);
    send_log_to_frontend(&app_handle, "info", &success_msg, "Export");
    
    Ok(success_msg)
}

// 数据导入命令
#[tauri::command]
async fn import_data(app_handle: tauri::AppHandle, import_path: String) -> Result<String, String> {
    send_log_to_frontend(&app_handle, "info", "开始导入数据", "Import");
    
    // 展开用户路径
    let expanded_path = if import_path.starts_with("~/") {
        match dirs::home_dir() {
            Some(home) => home.join(&import_path[2..]),
            None => return Err("无法获取用户主目录".to_string()),
        }
    } else {
        PathBuf::from(&import_path)
    };
    
    if !expanded_path.exists() {
        return Err("导入文件不存在".to_string());
    }
    
    // 验证文件是SQLite数据库
    let file_header = fs::read(&expanded_path)
        .map_err(|e| format!("读取导入文件失败: {}", e))?;
    
    if file_header.len() < 16 || &file_header[0..15] != b"SQLite format 3" {
        return Err("导入文件不是有效的SQLite数据库".to_string());
    }
    
    let db_path = get_database_path(&app_handle)?;
    
    // 创建当前数据的备份
    if db_path.exists() {
        let backup_path = db_path.with_extension("db.backup_before_import");
        fs::copy(&db_path, &backup_path)
            .map_err(|e| format!("创建导入前备份失败: {}", e))?;
        send_log_to_frontend(&app_handle, "info", &format!("已创建导入前备份: {:?}", backup_path), "Import");
    }
    
    // 导入新数据
    fs::copy(&expanded_path, &db_path)
        .map_err(|e| format!("导入数据失败: {}", e))?;
    
    // 重新初始化数据库连接
    send_log_to_frontend(&app_handle, "info", "重新初始化数据库连接", "Import");
    
    let db_state = app_handle.state::<DatabaseState>();
    match Database::new(db_path).await {
        Ok(new_db) => {
            let mut db_guard = db_state.0.lock().await;
            *db_guard = Some(new_db);
            send_log_to_frontend(&app_handle, "info", "数据库连接已更新", "Import");
        }
        Err(e) => {
            let error_msg = format!("重新初始化数据库失败: {}", e);
            send_log_to_frontend(&app_handle, "error", &error_msg, "Import");
            return Err(error_msg);
        }
    }
    
    let success_msg = format!("数据已成功从 {:?} 导入并重新加载", expanded_path);
    send_log_to_frontend(&app_handle, "info", &success_msg, "Import");
    
    Ok(success_msg)
}

// 获取数据统计信息
#[tauri::command]
async fn get_data_stats(app_handle: tauri::AppHandle) -> Result<String, String> {
    let db_path = get_database_path(&app_handle)?;
    
    if !db_path.exists() {
        return Ok("数据库文件不存在".to_string());
    }
    
    let file_size = fs::metadata(&db_path)
        .map_err(|e| format!("获取文件信息失败: {}", e))?
        .len();
    
    let size_mb = file_size as f64 / (1024.0 * 1024.0);
    
    // 获取备份数量
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    
    let backup_dir = app_data_dir.join("backups");
    let backup_count = if backup_dir.exists() {
        fs::read_dir(&backup_dir)
            .map_err(|e| format!("读取备份目录失败: {}", e))?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry.file_name()
                    .to_string_lossy()
                    .starts_with("testx_backup_")
            })
            .count()
    } else {
        0
    };
    
    let stats = format!(
        "数据库路径: {:?}\n数据库大小: {:.2} MB\n自动备份数量: {} 个",
        db_path, size_mb, backup_count
    );
    
    Ok(stats)
}

#[tokio::main]
async fn main() {
    let logger = FrontendLogger::new();
    log::set_boxed_logger(Box::new(logger.clone())).unwrap();
    log::set_max_level(log::LevelFilter::Debug);

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            logger.set_app_handle(app.handle().clone());
            
            // 启动高性能日志刷新定时器
            crate::logger::Logger::start_flush_timer(app.handle().clone());
            
            // 初始化数据库状态
            let db_path = get_database_path(app.handle())?;
            
            // 创建一个空的数据库状态
            let db_state = DatabaseState(Arc::new(tokio::sync::Mutex::new(None)));
            app.manage(db_state.clone());
            
            // 在后台初始化数据库
            tauri::async_runtime::spawn(async move {
                match Database::new(db_path).await {
                    Ok(db) => {
                        let mut db_guard = db_state.0.lock().await;
                        *db_guard = Some(db);
                    }
                    Err(e) => {
                        eprintln!("初始化数据库失败: {}", e);
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            save_text_file,
            execute_python_code_command,
            execute_python_code_with_variables,
            get_python_template,
            recognize_speech,
            save_speech_config,
            save_iot_config,
            load_speech_config,
            load_iot_config,
            delete_config,
            save_recognition_config,
            load_recognition_config,
            save_hotword_config,
            load_hotword_config,
            check_config_status,
            send_iot_message,
            send_iot_message_with_precomputed_params,
            send_iot_message_from_python,
            get_message_tests,
            delete_message_test,
            get_message_test_by_id,
            retest_message,
            create_accuracy_test,
            get_accuracy_tests,
            delete_accuracy_test,
            execute_accuracy_test_python_code,
            perform_speech_recognition,
            get_accuracy_test_python_template,
            execute_accuracy_test_with_message,
            execute_accuracy_test_with_params,
            execute_accuracy_test_with_params_precomputed,
            create_timed_recording_task,
            export_data,
            import_data,
            get_data_stats,
            get_all_variables,
            create_variable,
            update_variable,
            delete_variable,
            get_variable_by_name,
            initialize_database,
            save_user_preference,
            load_user_preference,
            // 串口功能
            scan_serial_ports,
            connect_serial_port,
            disconnect_serial_port,
            is_serial_port_connected,
            // VAD功能已移除
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
