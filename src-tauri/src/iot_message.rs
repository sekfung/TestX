use aliyun_iot_rust_sdk::{IoT, IoTClient, IoTApi, PubRequest};
use crate::database::{Database, MessageTest};
use crate::config::load_iot_config;
use chrono::Utc;
use uuid::Uuid;
use tauri::{AppHandle, State};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::future::Future;
use std::pin::Pin;
use crate::logger::Logger;

// 全局数据库实例
#[derive(Clone)]
pub struct DatabaseState(pub Arc<Mutex<Option<Database>>>);

impl DatabaseState {
    pub async fn with_db<F, R>(&self, f: F) -> Result<R, String>
    where
        F: for<'a> FnOnce(&'a Database) -> Pin<Box<dyn Future<Output = Result<R, String>> + Send + 'a>>,
        R: Send + 'static,
    {
        let guard = self.0.lock().await;
        if let Some(ref db) = *guard {
            f(db).await
        } else {
            Err("数据库未初始化".to_string())
        }
    }
}

#[tauri::command]
pub async fn send_iot_message(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
    topic: String,
    qos_level: i32,
    payload: String,
    product_key: String,
    device_name: String,
    mode: Option<String>,
    python_code: Option<String>,
) -> Result<String, String> {
    // 发送日志到前端
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };

    send_log("info", &format!("开始发送IoT消息到主题: {}", topic));

    // 检查数据库状态
    {
        let db_guard = database.0.lock().await;
        if db_guard.is_none() {
            let error_msg = "数据库未初始化，请等待应用完全启动后再试";
            send_log("error", error_msg);
            return Err(error_msg.to_string());
        }
        send_log("debug", "数据库状态检查通过");
    }

    // 验证必要参数
    if product_key.is_empty() {
        let error_msg = "Product Key不能为空";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }
    
    if device_name.is_empty() {
        let error_msg = "Device Name不能为空";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }

    send_log("debug", &format!("使用参数 product_key: {}, device_name: {}", product_key, device_name));

    // 生成消息ID
    let message_id = Uuid::new_v4().to_string();
    
    // 创建消息测试记录
    let message_test = MessageTest {
        id: message_id.clone(),
        topic: topic.clone(),
        qos_level,
        payload: payload.clone(),
        status: "pending".to_string(),
        sent_at: None,
        response: None,
        created_at: Utc::now(),
        product_key: Some(product_key.clone()),
        device_name: Some(device_name.clone()),
        mode: mode.unwrap_or_else(|| "form".to_string()),
        python_code,
        notes: None,
    };

    // 保存到数据库
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        if let Err(e) = db.create_message_test(&message_test).await {
            let error_msg = format!("保存消息记录失败: {}", e);
            send_log("error", &error_msg);
            return Err(error_msg);
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }
    drop(db_guard);

    send_log("debug", "消息记录已保存到数据库");

    // 加载IoT配置
    let iot_config_option = match load_iot_config(app_handle.clone()).await {
        Ok(config) => config,
        Err(e) => {
            let error_msg = format!("加载IoT配置失败: {}", e);
            send_log("error", &error_msg);
            
            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(&error_msg)).await;
            }
            return Err(error_msg);
        }
    };

    let iot_config = match iot_config_option {
        Some(config) => config,
        None => {
            let error_msg = "IoT平台配置未设置。请前往【设置】->【IoT平台】页面配置阿里云IoT平台的AccessKey信息";
            send_log("error", error_msg);
            
            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(error_msg)).await;
            }
            return Err(error_msg.to_string());
        }
    };

    send_log("debug", "IoT配置加载成功");

    // 创建IoT客户端
    let region_id = if iot_config.region_id.is_empty() {
        "cn-shanghai".to_string()
    } else {
        iot_config.region_id
    };

    let iot = IoT::new(
        &iot_config.access_key_id,
        &iot_config.access_key_secret,
        &region_id,
    );
    let client = IoTClient::new(iot);

    send_log("info", &format!("准备发送消息到主题: {}", topic));

    // 创建发布请求
    let pub_request = PubRequest::new(
        product_key,
        topic,
        payload.clone(),
    ).with_qos(qos_level);

    send_log("debug", &format!("发布请求已创建，QoS级别: {}", qos_level));

    // 发送消息
    let result = client.pub_message(pub_request).await;

    match result {
        Ok(response) => {
            let message_id_text = response.message_id
                .map(|id| id.to_string())
                .unwrap_or_else(|| "未返回".to_string());
            
            let success_msg = format!("消息发送成功，MessageId: {}", message_id_text);
            send_log("info", &success_msg);

            // 更新数据库状态为成功
            if let Some(db) = database.0.lock().await.as_ref() {
                let response_text = format!(
                    "MessageId: {}, RequestId: {}, Success: {}",
                    message_id_text,
                    response.request_id,
                    response.success
                );
                let _ = db.update_message_test_status(&message_id, "sent", Some(Utc::now()), Some(&response_text)).await;
            }

            Ok(message_id)
        }
        Err(e) => {
            let error_msg = format!("消息发送失败: {}", e);
            send_log("error", &error_msg);

            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(&error_msg)).await;
            }

            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn send_iot_message_with_precomputed_params(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
    topic: String,
    qos_level: i32,
    payload: String,
    product_key: String,
    device_name: String,
    mode: Option<String>,
    python_code: Option<String>,
    // 新增：是否使用预计算参数
    use_precomputed: Option<bool>,
) -> Result<String, String> {
    // 发送日志到前端
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };

    // 如果是代码模式且没有使用预计算参数，则执行Python代码获取参数
    let (final_topic, final_qos_level, final_payload, final_product_key, final_device_name) = 
        if mode.as_deref() == Some("code") && !use_precomputed.unwrap_or(false) {
            if let Some(python_code) = &python_code {
                send_log("info", "代码模式：执行Python代码获取参数");
                
                let python_result = crate::python_executor::execute_python_code_async(&app_handle, python_code).await;
                
                if !python_result.success {
                    let error_msg = format!("Python代码执行失败: {}", 
                        python_result.error.unwrap_or_else(|| "未知错误".to_string()));
                    send_log("error", &error_msg);
                    return Err(error_msg);
                }
                
                let iot_params = python_result.result.ok_or_else(|| {
                    let error_msg = "Python代码未返回有效结果";
                    send_log("error", error_msg);
                    error_msg.to_string()
                })?;
                
                send_log("info", "Python代码执行成功，使用生成的参数");
                (iot_params.topic, iot_params.qos_level, iot_params.payload, product_key, device_name)
            } else {
                send_log("warn", "代码模式但缺少Python代码，使用传入参数");
                (topic, qos_level, payload, product_key, device_name)
            }
        } else {
            if use_precomputed.unwrap_or(false) {
                send_log("info", "代码模式：使用预计算参数");
            } else {
                send_log("info", "表单模式：使用传入参数");
            }
            (topic, qos_level, payload, product_key, device_name)
        };

    send_log("info", &format!("开始发送IoT消息到主题: {}", final_topic));

    // 检查数据库状态
    {
        let db_guard = database.0.lock().await;
        if db_guard.is_none() {
            let error_msg = "数据库未初始化，请等待应用完全启动后再试";
            send_log("error", error_msg);
            return Err(error_msg.to_string());
        }
        send_log("debug", "数据库状态检查通过");
    }

    // 验证必要参数
    if final_product_key.is_empty() {
        let error_msg = "Product Key不能为空";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }
    
    if final_device_name.is_empty() {
        let error_msg = "Device Name不能为空";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }

    send_log("debug", &format!("使用参数 product_key: {}, device_name: {}", final_product_key, final_device_name));

    // 生成消息ID
    let message_id = Uuid::new_v4().to_string();
    
    // 创建消息测试记录
    let message_test = MessageTest {
        id: message_id.clone(),
        topic: final_topic.clone(),
        qos_level: final_qos_level,
        payload: final_payload.clone(),
        status: "pending".to_string(),
        sent_at: None,
        response: None,
        created_at: Utc::now(),
        product_key: Some(final_product_key.clone()),
        device_name: Some(final_device_name.clone()),
        mode: mode.unwrap_or_else(|| "form".to_string()),
        python_code,
        notes: None,
    };

    // 保存到数据库
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        if let Err(e) = db.create_message_test(&message_test).await {
            let error_msg = format!("保存消息记录失败: {}", e);
            send_log("error", &error_msg);
            return Err(error_msg);
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    }
    drop(db_guard);

    send_log("debug", "消息记录已保存到数据库");

    // 加载IoT配置
    let iot_config_option = match load_iot_config(app_handle.clone()).await {
        Ok(config) => config,
        Err(e) => {
            let error_msg = format!("加载IoT配置失败: {}", e);
            send_log("error", &error_msg);
            
            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(&error_msg)).await;
            }
            return Err(error_msg);
        }
    };

    let iot_config = match iot_config_option {
        Some(config) => config,
        None => {
            let error_msg = "IoT平台配置未设置。请前往【设置】->【IoT平台】页面配置阿里云IoT平台的AccessKey信息";
            send_log("error", error_msg);
            
            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(error_msg)).await;
            }
            return Err(error_msg.to_string());
        }
    };

    send_log("debug", "IoT配置加载成功");

    // 创建IoT客户端
    let region_id = if iot_config.region_id.is_empty() {
        "cn-shanghai".to_string()
    } else {
        iot_config.region_id
    };

    let iot = IoT::new(
        &iot_config.access_key_id,
        &iot_config.access_key_secret,
        &region_id,
    );
    let client = IoTClient::new(iot);

    send_log("info", &format!("准备发送消息到主题: {}", final_topic));

    // 创建发布请求
    let pub_request = PubRequest::new(
        final_product_key,
        final_topic,
        final_payload.clone(),
    ).with_qos(final_qos_level);

    send_log("debug", &format!("发布请求已创建，QoS级别: {}", final_qos_level));

    // 发送消息
    let result = client.pub_message(pub_request).await;

    match result {
        Ok(response) => {
            let message_id_text = response.message_id
                .map(|id| id.to_string())
                .unwrap_or_else(|| "未返回".to_string());
            
            let success_msg = format!("消息发送成功，MessageId: {}", message_id_text);
            send_log("info", &success_msg);

            // 更新数据库状态为成功
            if let Some(db) = database.0.lock().await.as_ref() {
                let response_text = format!(
                    "MessageId: {}, RequestId: {}, Success: {}",
                    message_id_text,
                    response.request_id,
                    response.success
                );
                let _ = db.update_message_test_status(&message_id, "sent", Some(Utc::now()), Some(&response_text)).await;
            }

            Ok(message_id)
        }
        Err(e) => {
            let error_msg = format!("消息发送失败: {}", e);
            send_log("error", &error_msg);

            // 更新数据库状态为失败
            if let Some(db) = database.0.lock().await.as_ref() {
                let _ = db.update_message_test_status(&message_id, "failed", None, Some(&error_msg)).await;
            }

            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn get_message_tests(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<Vec<MessageTest>, String> {
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };


    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        match db.get_all_message_tests().await {
            Ok(tests) => {
                send_log("info", &format!("成功获取{}条消息测试记录", tests.len()));
                Ok(tests)
            }
            Err(e) => {
                let error_msg = format!("获取消息测试记录失败: {}", e);
                send_log("error", &error_msg);
                Err(error_msg)
            }
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        Err(error_msg.to_string())
    }
}

#[tauri::command]
pub async fn delete_message_test(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };

    send_log("info", &format!("删除消息测试记录: {}", id));

    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        match db.delete_message_test(&id).await {
            Ok(_) => {
                send_log("info", "消息测试记录删除成功");
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("删除消息测试记录失败: {}", e);
                send_log("error", &error_msg);
                Err(error_msg)
            }
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        Err(error_msg.to_string())
    }
}

#[tauri::command]
pub async fn get_message_test_by_id(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
    id: String,
) -> Result<Option<MessageTest>, String> {
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };


    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        match db.get_message_test_by_id(&id).await {
            Ok(test) => {
                if test.is_some() {
                    send_log("info", "成功获取消息测试记录");
                } else {
                    send_log("warn", "未找到指定的消息测试记录");
                }
                Ok(test)
            }
            Err(e) => {
                let error_msg = format!("获取消息测试记录失败: {}", e);
                send_log("error", &error_msg);
                Err(error_msg)
            }
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        Err(error_msg.to_string())
    }
}

#[tauri::command]
pub async fn retest_message(
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
    id: String,
) -> Result<String, String> {
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "IoT"),
            "warn" => Logger::warn(&app_handle, message, "IoT"),
            "error" => Logger::error(&app_handle, message, "IoT"),
            "debug" => Logger::debug(&app_handle, message, "IoT"),
            _ => Logger::info(&app_handle, message, "IoT"),
        }
    };

    send_log("info", &format!("重新测试消息记录: {}", id));

    // 首先获取原始记录
    let db_guard = database.0.lock().await;
    let original_test = if let Some(db) = db_guard.as_ref() {
        match db.get_message_test_by_id(&id).await {
            Ok(Some(test)) => test,
            Ok(None) => {
                let error_msg = "未找到指定的消息测试记录";
                send_log("error", error_msg);
                return Err(error_msg.to_string());
            }
            Err(e) => {
                let error_msg = format!("获取消息测试记录失败: {}", e);
                send_log("error", &error_msg);
                return Err(error_msg);
            }
        }
    } else {
        let error_msg = "数据库未初始化";
        send_log("error", error_msg);
        return Err(error_msg.to_string());
    };
    drop(db_guard);

    // 如果是代码模式且有Python代码，重新执行代码
    if original_test.mode == "code" {
        if let Some(python_code) = &original_test.python_code {
            send_log("info", "重新执行Python代码");
            
            // 执行Python代码获取新的参数
            let python_result = crate::python_executor::execute_python_code_async(&app_handle, python_code).await;
            
            if !python_result.success {
                let error_msg = format!("Python代码执行失败: {}", 
                    python_result.error.unwrap_or_else(|| "未知错误".to_string()));
                send_log("error", &error_msg);
                return Err(error_msg);
            }
            
            let iot_params = python_result.result.ok_or_else(|| {
                let error_msg = "Python代码未返回有效结果";
                send_log("error", error_msg);
                error_msg.to_string()
            })?;
            
            // 使用新的参数重新发送消息
            return send_iot_message(
                app_handle,
                database,
                iot_params.topic,
                iot_params.qos_level,
                iot_params.payload,
                original_test.product_key.unwrap_or_default(),
                original_test.device_name.unwrap_or_default(),
                Some("code".to_string()),
                Some(python_code.clone()),
            ).await;
        } else {
            let error_msg = "代码模式记录缺少Python代码";
            send_log("error", error_msg);
            return Err(error_msg.to_string());
        }
    } else {
        // 表单模式，直接使用原始参数重新发送
        return send_iot_message(
            app_handle,
            database,
            original_test.topic,
            original_test.qos_level,
            original_test.payload,
            original_test.product_key.unwrap_or_default(),
            original_test.device_name.unwrap_or_default(),
            Some("form".to_string()),
            None,
        ).await;
    }
}