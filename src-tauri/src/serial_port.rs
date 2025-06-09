use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serialport::{SerialPort, SerialPortInfo};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time::sleep;
use log::{info, error, warn};
use serde_json;
use crate::logger::Logger;

// 全局串口连接管理器
lazy_static::lazy_static! {
    static ref SERIAL_MANAGER: Arc<Mutex<SerialManager>> = Arc::new(Mutex::new(SerialManager::new()));
}

// 串口管理器
struct SerialManager {
    connections: HashMap<String, SerialConnection>,
}

// 串口连接信息
struct SerialConnection {
    port: Box<dyn SerialPort>,
    stop_tx: Option<mpsc::UnboundedSender<()>>,
}



impl SerialManager {
    fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    fn add_connection(&mut self, port_name: String, port: Box<dyn SerialPort>, stop_tx: mpsc::UnboundedSender<()>) {
        let connection = SerialConnection {
            port,
            stop_tx: Some(stop_tx),
        };
        self.connections.insert(port_name, connection);
    }

    fn remove_connection(&mut self, port_name: &str) -> Option<SerialConnection> {
        self.connections.remove(port_name)
    }

    fn is_connected(&self, port_name: &str) -> bool {
        self.connections.contains_key(port_name)
    }
}

// 扫描可用串口
#[tauri::command]
pub async fn scan_serial_ports() -> Result<Vec<String>, String> {
    match serialport::available_ports() {
        Ok(ports) => {
            let port_names: Vec<String> = ports
                .into_iter()
                .map(|port| port.port_name)
                .collect();
            info!("扫描到 {} 个串口: {:?}", port_names.len(), port_names);
            Ok(port_names)
        }
        Err(e) => {
            error!("扫描串口失败: {}", e);
            Err(format!("扫描串口失败: {}", e))
        }
    }
}

// 连接串口
#[tauri::command]
pub async fn connect_serial_port(
    app_handle: AppHandle,
    port: String,
    baud_rate: u32,
) -> Result<(), String> {
    // 检查是否已经连接
    {
        let manager = SERIAL_MANAGER.lock().map_err(|e| format!("获取串口管理器失败: {}", e))?;
        if manager.is_connected(&port) {
            return Err("串口已经连接".to_string());
        }
    }

    // 打开串口
    let serial_port = serialport::new(&port, baud_rate)
        .timeout(Duration::from_millis(1000))
        .open()
        .map_err(|e| format!("打开串口失败: {}", e))?;

    info!("成功连接串口: {}, 波特率: {}", port, baud_rate);

    // 创建停止信号通道
    let (stop_tx, mut stop_rx) = mpsc::unbounded_channel();

    // 将连接添加到管理器
    {
        let mut manager = SERIAL_MANAGER.lock().map_err(|e| format!("获取串口管理器失败: {}", e))?;
        manager.add_connection(port.clone(), serial_port, stop_tx);
    }

    // 启动串口数据读取任务
    let port_clone = port.clone();
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        let mut buffer = [0; 1024];
        let mut line_buffer = String::new();

        loop {
            // 检查是否收到停止信号
            if stop_rx.try_recv().is_ok() {
                info!("收到停止信号，退出串口读取任务: {}", port_clone);
                break;
            }

            // 从串口管理器中获取串口连接
            let read_result = {
                let mut manager = match SERIAL_MANAGER.lock() {
                    Ok(m) => m,
                    Err(e) => {
                        error!("获取串口管理器失败: {}", e);
                        break;
                    }
                };

                if let Some(connection) = manager.connections.get_mut(&port_clone) {
                    connection.port.read(&mut buffer)
                } else {
                    // 串口连接不存在，退出读取循环
                    break;
                }
            };

            match read_result {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                        line_buffer.push_str(&data);

                        // 按行处理数据
                        while let Some(newline_pos) = line_buffer.find('\n') {
                            let line = line_buffer[..newline_pos].trim().to_string();
                            line_buffer = line_buffer[newline_pos + 1..].to_string();

                            if !line.is_empty() {
                                // 使用重构后的Logger进行串口日志打印
                                crate::logger::Logger::serial_info(&app_handle_clone, &line, &port_clone);
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    // 超时时继续等待
                    sleep(Duration::from_millis(10)).await;
                }
                Err(e) => {
                    // 读取串口数据失败，记录错误并退出
                    crate::logger::Logger::serial_error(&app_handle_clone, &format!("串口读取失败: {}", e), &port_clone);
                    break;
                }
            }

            // 短暂休眠避免过度占用CPU
            sleep(Duration::from_millis(10)).await;
        }

        info!("串口读取任务结束: {}", port_clone);
    });

    Ok(())
}

// 断开串口连接
#[tauri::command]
pub async fn disconnect_serial_port(port: String) -> Result<(), String> {
    let mut manager = SERIAL_MANAGER.lock().map_err(|e| format!("获取串口管理器失败: {}", e))?;
    
    if let Some(mut connection) = manager.remove_connection(&port) {
        // 发送停止信号
        if let Some(stop_tx) = connection.stop_tx.take() {
            let _ = stop_tx.send(());
        }
        // 成功断开串口连接
        Ok(())
    } else {
        Err("串口未连接".to_string())
    }
}

// 检查串口连接状态
#[tauri::command]
pub async fn is_serial_port_connected(port: String) -> Result<bool, String> {
    let manager = SERIAL_MANAGER.lock().map_err(|e| format!("获取串口管理器失败: {}", e))?;
    Ok(manager.is_connected(&port))
}