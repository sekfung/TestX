use serde_json::json;
use tauri::{AppHandle, Emitter};
use log::{debug, error, info, warn};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use tokio::time::sleep;
use lazy_static::lazy_static;

/// 日志缓冲区结构
#[derive(Debug)]
struct LogBuffer {
    logs: Vec<serde_json::Value>,
    last_flush: Instant,
    max_size: usize,
    flush_interval: Duration,
}

impl LogBuffer {
    fn new() -> Self {
        Self {
            logs: Vec::new(),
            last_flush: Instant::now(),
            max_size: 50, // 最多缓存50条日志
            flush_interval: Duration::from_millis(100), // 100ms刷新一次
        }
    }
    
    fn add_log(&mut self, log: serde_json::Value) {
        self.logs.push(log);
    }
    
    fn should_flush(&self) -> bool {
        self.logs.len() >= self.max_size || self.last_flush.elapsed() >= self.flush_interval
    }
    
    fn flush(&mut self) -> Vec<serde_json::Value> {
        let logs = self.logs.drain(..).collect();
        self.last_flush = Instant::now();
        logs
    }
    
    fn is_empty(&self) -> bool {
        self.logs.is_empty()
    }
}

/// 全局日志缓冲区管理器
lazy_static::lazy_static! {
    static ref LOG_BUFFER_MANAGER: Arc<Mutex<HashMap<String, LogBuffer>>> = Arc::new(Mutex::new(HashMap::new()));
}

/// 统一的日志管理器
pub struct Logger;

impl Logger {
    /// 批量发送日志到前端（高性能版本）
    pub fn log_batch(app_handle: &AppHandle, level: &str, message: &str, source: &str, log_type: &str) {
        let buffer_key = format!("{}-{}", source, log_type);
        let log_entry = json!({
            "level": level,
            "type": log_type,
            "message": message,
            "source": source
        });
        
        // 添加到缓冲区
        if let Ok(mut manager) = LOG_BUFFER_MANAGER.lock() {
            let buffer = manager.entry(buffer_key.clone()).or_insert_with(LogBuffer::new);
            buffer.add_log(log_entry);
            
            // 检查是否需要刷新
            if buffer.should_flush() {
                let logs = buffer.flush();
                if !logs.is_empty() {
                    Self::send_batch_logs(app_handle, &logs);
                }
            }
        }
        
        // 同时记录到Rust日志系统
        match level {
            "info" => info!(target: &format!("testx::{}", source.to_lowercase()), "{}", message),
            "warn" => warn!(target: &format!("testx::{}", source.to_lowercase()), "{}", message),
            "error" => error!(target: &format!("testx::{}", source.to_lowercase()), "{}", message),
            "debug" => debug!(target: &format!("testx::{}", source.to_lowercase()), "{}", message),
            _ => info!(target: &format!("testx::{}", source.to_lowercase()), "{}", message),
        }
    }
    
    /// 强制刷新所有缓冲区
    pub fn flush_all_buffers(app_handle: &AppHandle) {
        if let Ok(mut manager) = LOG_BUFFER_MANAGER.lock() {
            for (_, buffer) in manager.iter_mut() {
                if !buffer.is_empty() {
                    let logs = buffer.flush();
                    Self::send_batch_logs(app_handle, &logs);
                }
            }
        }
    }
    
    /// 启动定时刷新任务
    pub fn start_flush_timer(app_handle: AppHandle) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(100));
            loop {
                interval.tick().await;
                Self::flush_all_buffers(&app_handle);
            }
        });
    }
    
    /// 批量发送日志到前端
    fn send_batch_logs(app_handle: &AppHandle, logs: &[serde_json::Value]) {
        if !logs.is_empty() {
            if let Err(e) = app_handle.emit("rust-log-batch", logs) {
                eprintln!("❌ 批量日志事件发送失败: {}", e);
            }
        }
    }
    
    /// 发送信息级别日志到前端（高性能版本）
    pub fn info(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "info", message, source, "software");
    }
    
    /// 发送信息级别日志到前端（立即发送版本）
    pub fn info_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "info", message, source, "software");
        info!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送警告级别日志到前端（高性能版本）
    pub fn warn(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "warn", message, source, "software");
    }
    
    /// 发送警告级别日志到前端（立即发送版本）
    pub fn warn_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "warn", message, source, "software");
        warn!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送错误级别日志到前端（高性能版本）
    pub fn error(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "error", message, source, "software");
    }
    
    /// 发送错误级别日志到前端（立即发送版本）
    pub fn error_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "error", message, source, "software");
        error!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送调试级别日志到前端（高性能版本）
    pub fn debug(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "debug", message, source, "software");
    }
    
    /// 发送调试级别日志到前端（立即发送版本）
    pub fn debug_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "debug", message, source, "software");
        debug!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送串口信息级别日志到前端（高性能版本）
    pub fn serial_info(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "info", message, source, "serial");
    }
    
    /// 发送串口信息级别日志到前端（立即发送版本）
    pub fn serial_info_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "info", message, source, "serial");
        info!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送串口警告级别日志到前端（高性能版本）
    pub fn serial_warn(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "warn", message, source, "serial");
    }
    
    /// 发送串口警告级别日志到前端（立即发送版本）
    pub fn serial_warn_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "warn", message, source, "serial");
        warn!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送串口错误级别日志到前端（高性能版本）
    pub fn serial_error(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "error", message, source, "serial");
    }
    
    /// 发送串口错误级别日志到前端（立即发送版本）
    pub fn serial_error_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "error", message, source, "serial");
        error!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 发送串口调试级别日志到前端（高性能版本）
    pub fn serial_debug(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log_batch(app_handle, "debug", message, source, "serial");
    }
    
    /// 发送串口调试级别日志到前端（立即发送版本）
    pub fn serial_debug_immediate(app_handle: &AppHandle, message: &str, source: &str) {
        Self::log(app_handle, "debug", message, source, "serial");
        debug!(target: &format!("testx::{}", source.to_lowercase()), "{}", message);
    }

    /// 内部日志发送方法 - 发送到前端自定义LogConsole
    /// 通过emit("rust-log")事件发送到前端，前端的initRustLogListener会监听此事件
    /// 并将日志添加到useLogStore中，最终显示在自定义的LogConsole组件中
    fn log(app_handle: &AppHandle, level: &str, message: &str, source: &str, log_type: &str) {
        let log_entry = json!({
            "level": level,
            "type": log_type,
            "message": message,
            "source": source
        });
        
        // 发送到前端自定义LogConsole，而不是tauri自带的console
        if let Err(e) = app_handle.emit("rust-log", &log_entry) {
            eprintln!("❌ 日志事件发送失败: {}", e);
        }
    }

    /// 格式化带参数的日志消息
    pub fn info_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::info(app_handle, &message, source);
    }

    /// 格式化带参数的警告消息
    pub fn warn_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::warn(app_handle, &message, source);
    }

    /// 格式化带参数的错误消息
    pub fn error_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::error(app_handle, &message, source);
    }

    /// 格式化带参数的调试消息
    pub fn debug_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::debug(app_handle, &message, source);
    }

    /// 格式化带参数的串口信息消息
    pub fn serial_info_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::serial_info(app_handle, &message, source);
    }

    /// 格式化带参数的串口警告消息
    pub fn serial_warn_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::serial_warn(app_handle, &message, source);
    }

    /// 格式化带参数的串口错误消息
    pub fn serial_error_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::serial_error(app_handle, &message, source);
    }

    /// 格式化带参数的串口调试消息
    pub fn serial_debug_with_params(app_handle: &AppHandle, template: &str, params: &[(&str, &dyn std::fmt::Display)], source: &str) {
        let message = Self::format_message(template, params);
        Self::serial_debug(app_handle, &message, source);
    }

    /// 格式化消息模板
    fn format_message(template: &str, params: &[(&str, &dyn std::fmt::Display)]) -> String {
        let mut message = template.to_string();
        for (key, value) in params {
            let placeholder = format!("{{{}}}", key);
            message = message.replace(&placeholder, &value.to_string());
        }
        message
    }
}

/// 便捷宏定义
#[macro_export]
macro_rules! log_info {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::info($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_warn {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::warn($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_error {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::error($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_debug {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::debug($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_serial_info {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::serial_info($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_serial_warn {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::serial_warn($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_serial_error {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::serial_error($app_handle, &format!($($arg)*), $source)
    };
}

#[macro_export]
macro_rules! log_serial_debug {
    ($app_handle:expr, $source:expr, $($arg:tt)*) => {
        $crate::logger::Logger::serial_debug($app_handle, &format!($($arg)*), $source)
    };
}