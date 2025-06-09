use crate::database::AccuracyTest;
use crate::iot_message::DatabaseState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{State, AppHandle, Emitter};
use uuid::Uuid;
use std::fs;
use bytes::Bytes;
use tencentcloud_speech_rust_sdk::{SpeechClient, FlashRecognitionConfig};
use crate::python_executor::PythonExecutionResult;
use tauri::command;
use base64::{Engine as _, engine::general_purpose};
use crate::config::get_speech_config;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use chrono::{DateTime, Local};
use lazy_static::lazy_static;
use crate::logger::Logger;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccuracyTestRequest {
    pub expected_text: String,
    pub mode: String, // form, code
    pub python_code: Option<String>,
    pub notes: Option<String>,
    pub test_mode: String, // manual, loop, timed
    pub loop_count: Option<i32>, // 循环次数（循环模式使用）
    pub scheduled_time: Option<String>, // 定时录音时间（定时模式使用）
}

// 定时录音任务信息
#[derive(Debug, Clone)]
pub struct TimedRecordingTask {
    pub test_id: String,
    pub scheduled_time: DateTime<Local>,
    pub iot_params: IoTParams,
    pub expected_text: String,
    pub python_code: Option<String>,
}

// IoT参数结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoTParams {
    pub topic: String,
    pub qos_level: i32,
    pub payload: String,
    pub product_key: String,
    pub device_name: String,
}

// 全局定时录音管理器
type TimedRecordingManager = Arc<Mutex<HashMap<String, TimedRecordingTask>>>;

// 创建全局管理器实例
lazy_static! {
    static ref TIMED_RECORDING_TASKS: TimedRecordingManager = Arc::new(Mutex::new(HashMap::new()));
}

// 创建定时录音任务
#[command]
pub async fn create_timed_recording_task(
    testid: String,
    scheduledtime: String,
    iottopic: String,
    iotqoslevel: i32,
    iotpayload: String,
    iotproductkey: String,
    iotdevicename: String,
    expectedtext: String,
    pythoncode: Option<String>,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<(), String> {
    // 记录函数调用日志
    Logger::info(&app_handle, &format!("开始创建定时录音任务 - testid: {}, scheduledtime: {}", testid, scheduledtime), "TimedRecording");
    // 解析定时时间
    let scheduled_datetime = match DateTime::parse_from_rfc3339(&scheduledtime) {
        Ok(dt) => {
            let local_dt = dt.with_timezone(&Local);
            Logger::debug(&app_handle, &format!("成功解析定时时间: {} -> {}", scheduledtime, local_dt), "TimedRecording");
            local_dt
        },
        Err(e) => {
            let error_msg = format!("无法解析定时时间: {}", e);
            Logger::error(&app_handle, &error_msg, "TimedRecording");
            return Err(error_msg);
        },
    };
    
    // 检查时间是否在未来
    let now = Local::now();
    Logger::debug(&app_handle, &format!("时间检查 - 当前时间: {}, 定时时间: {}", now, scheduled_datetime), "TimedRecording");
    
    if scheduled_datetime <= now {
        let error_msg = "定时时间必须是未来时间".to_string();
        Logger::error(&app_handle, &error_msg, "TimedRecording");
        return Err(error_msg);
    }
    
    // 创建IoT参数
    let iot_params = IoTParams {
        topic: iottopic.clone(),
        qos_level: iotqoslevel,
        payload: iotpayload.clone(),
        product_key: iotproductkey.clone(),
        device_name: iotdevicename.clone(),
    };
    
    Logger::debug(&app_handle, &format!("创建IoT参数 - topic: {}, qos: {}, product_key: {}, device_name: {}", 
                          iottopic, iotqoslevel, iotproductkey, iotdevicename), "TimedRecording");
    
    // 创建定时任务
    let task = TimedRecordingTask {
        test_id: testid.clone(),
        scheduled_time: scheduled_datetime,
        iot_params,
        expected_text: expectedtext.clone(),
        python_code: pythoncode.clone(),
    };
    
    Logger::info(&app_handle, &format!("创建定时任务成功 - testid: {}, expected_text: {}", testid, expectedtext), "TimedRecording");
    
    // 发送IoT消息
    Logger::info(&app_handle, &format!("开始发送IoT消息 - testid: {}", testid), "TimedRecording");
    
    let iot_result = crate::iot_message::send_iot_message_with_precomputed_params(
        app_handle.clone(),
        database.clone(),
        task.iot_params.topic.clone(),
        task.iot_params.qos_level,
        task.iot_params.payload.clone(),
        task.iot_params.product_key.clone(),
        task.iot_params.device_name.clone(),
        Some("accuracy_test".to_string()),
        task.python_code.clone(),
        Some(true), // 使用预计算参数
    ).await;
    
    // 处理IoT发送结果
    if let Err(e) = iot_result {
        let error_msg = format!("发送IoT消息失败: {}", e);
        Logger::error(&app_handle, &error_msg, "TimedRecording");
        return Err(error_msg);
    }
    
    Logger::info(&app_handle, &format!("IoT消息发送成功 - testid: {}", testid), "TimedRecording");
    
    // 将任务添加到管理器
    let mut tasks = TIMED_RECORDING_TASKS.lock().await;
    tasks.insert(testid.clone(), task.clone());
    let task_count = tasks.len();
    drop(tasks);
    
    Logger::info(&app_handle, &format!("任务已添加到管理器 - testid: {}, 当前任务总数: {}", testid, task_count), "TimedRecording");
    
    // 启动定时器
    let app_handle_clone = app_handle.clone();
    let test_id_clone = testid.clone();
    
    Logger::info(&app_handle, &format!("启动定时器 - testid: {}, 预定时间: {}", testid, scheduled_datetime), "TimedRecording");
    
    tokio::spawn(async move {
        // 计算等待时间
        let now = Local::now();
        let wait_duration = scheduled_datetime.signed_duration_since(now);
        
        Logger::debug(&app_handle_clone, &format!("计算等待时间 - testid: {}, 等待毫秒数: {}", test_id_clone, wait_duration.num_milliseconds()), "TimedRecording");
        
        if wait_duration.num_milliseconds() > 0 {
            Logger::info(&app_handle_clone, &format!("开始等待定时时间 - testid: {}, 等待{}毫秒", test_id_clone, wait_duration.num_milliseconds()), "TimedRecording");
            
            // 等待直到预定时间
            sleep(Duration::from_millis(wait_duration.num_milliseconds() as u64)).await;
            
            Logger::info(&app_handle_clone, &format!("定时时间到达，开始执行录音任务 - testid: {}", test_id_clone), "TimedRecording");
            
            // 时间到，执行录音任务
            execute_timed_recording(test_id_clone, app_handle_clone).await;
        } else {
            // 时间已过，记录错误
            Logger::error(&app_handle_clone, &format!("定时录音任务时间已过期: {}", test_id_clone), "TimedRecording");
        }
    });
    
    Ok(())
}

// 执行定时录音任务
async fn execute_timed_recording(test_id: String, app_handle: AppHandle) {
    Logger::info(&app_handle, &format!("开始执行定时录音任务 - testid: {}", test_id), "TimedRecording");
    
    // 获取任务信息
    let task_option = {
        let tasks = TIMED_RECORDING_TASKS.lock().await;
        let task_count = tasks.len();
        let task = tasks.get(&test_id).cloned();
        
        Logger::debug(&app_handle, &format!("查找任务 - testid: {}, 当前任务总数: {}, 任务存在: {}", test_id, task_count, task.is_some()), "TimedRecording");
        
        task
    };
    
    if let Some(task) = task_option {
        // 记录任务详情
        Logger::info(&app_handle, &format!("找到定时录音任务 - testid: {}, expected_text: {}, scheduled_time: {}", 
                              test_id, task.expected_text, task.scheduled_time), "TimedRecording");
        
        // 通知前端开始录音
        Logger::info(&app_handle, &format!("发送录音启动事件 - testid: {}", test_id), "TimedRecording");
        
        let emit_result = app_handle.emit("start_recording_for_test", &test_id);
        if let Err(e) = emit_result {
            Logger::error(&app_handle, &format!("发送录音启动事件失败 - testid: {}, error: {}", test_id, e), "TimedRecording");
        } else {
            Logger::info(&app_handle, &format!("录音启动事件发送成功 - testid: {}", test_id), "TimedRecording");
        }
        
        // 从管理器中移除任务
        let mut tasks = TIMED_RECORDING_TASKS.lock().await;
        let removed = tasks.remove(&test_id);
        let remaining_count = tasks.len();
        drop(tasks);
        
        Logger::info(&app_handle, &format!("任务清理完成 - testid: {}, 已移除: {}, 剩余任务数: {}", test_id, removed.is_some(), remaining_count), "TimedRecording");
    } else {
        // 任务不存在，记录错误
        Logger::error(&app_handle, &format!("定时录音任务不存在 - testid: {}", test_id), "TimedRecording");
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpeechRecognitionResult {
    pub success: bool,
    pub text: Option<String>,
    pub error: Option<String>,
    pub confidence: Option<f64>,
}

// 计算文本相似度（简单的编辑距离算法）
fn calculate_similarity(text1: &str, text2: &str) -> f64 {
    let len1 = text1.chars().count();
    let len2 = text2.chars().count();
    
    if len1 == 0 && len2 == 0 {
        return 1.0;
    }
    
    if len1 == 0 || len2 == 0 {
        return 0.0;
    }
    
    let chars1: Vec<char> = text1.chars().collect();
    let chars2: Vec<char> = text2.chars().collect();
    
    let mut dp = vec![vec![0; len2 + 1]; len1 + 1];
    
    for i in 0..=len1 {
        dp[i][0] = i;
    }
    for j in 0..=len2 {
        dp[0][j] = j;
    }
    
    for i in 1..=len1 {
        for j in 1..=len2 {
            if chars1[i - 1] == chars2[j - 1] {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + dp[i - 1][j].min(dp[i][j - 1]).min(dp[i - 1][j - 1]);
            }
        }
    }
    
    let distance = dp[len1][len2];
    let max_len = len1.max(len2);
    1.0 - (distance as f64 / max_len as f64)
}

#[command]
pub async fn create_accuracy_test(
    request: AccuracyTestRequest,
    database: State<'_, DatabaseState>,
) -> Result<AccuracyTest, String> {
    let test = AccuracyTest {
        id: Uuid::new_v4().to_string(),
        expected_text: request.expected_text,
        recognized_text: None,
        similarity: None,
        result: "pending".to_string(),
        created_at: Utc::now(),
        completed_at: None,
        audio_file_path: None,
        python_code: request.python_code,
        mode: request.mode,
        error_message: None,
        notes: request.notes,
        audio_data: None,
        audio_duration: None,
        test_mode: request.test_mode.clone(),
        loop_count: request.loop_count,
        scheduled_time: request.scheduled_time,
        current_loop: 0,
        auto_executed: request.test_mode != "manual",
    };
    let test_clone = test.clone();

    database.with_db(|db| {
        let test = test.clone();
        let fut = async move {
            db.create_accuracy_test(&test).await.map_err(|e| format!("创建测试失败: {}", e))?;
            Ok(test_clone)
        };
        Box::pin(fut)
    }).await
}

#[command]
pub async fn get_accuracy_tests(
    database: State<'_, DatabaseState>,
) -> Result<Vec<AccuracyTest>, String> {
    database.with_db(|db| {
        let fut = async move {
            db.get_all_accuracy_tests().await.map_err(|e| format!("获取测试列表失败: {}", e))
        };
        Box::pin(fut)
    }).await
}

#[command]
pub async fn delete_accuracy_test(
    id: String,
    database: State<'_, DatabaseState>,
) -> Result<(), String> {
    let id_clone = id.clone();
    database.with_db(|db| {
        let id = id_clone.clone();
        let fut = async move {
            db.delete_accuracy_test(&id).await.map_err(|e| format!("删除测试失败: {}", e))
        };
        Box::pin(fut)
    }).await
}

#[command]
pub async fn perform_speech_recognition(
    audio_path: String,
) -> Result<SpeechRecognitionResult, String> {
    // 从设置中获取腾讯云配置
    // 这里需要从配置文件或设置中读取
    let app_id = std::env::var("TENCENT_APP_ID").unwrap_or_default();
    let secret_id = std::env::var("TENCENT_SECRET_ID").unwrap_or_default();
    let secret_key = std::env::var("TENCENT_SECRET_KEY").unwrap_or_default();
    let region = "ap-beijing";
    
    if app_id.is_empty() || secret_id.is_empty() || secret_key.is_empty() {
        return Ok(SpeechRecognitionResult {
            success: false,
            text: None,
            error: Some("腾讯云语音识别配置未设置".to_string()),
            confidence: None,
        });
    }
    
    let client = SpeechClient::new(app_id, secret_id, secret_key, region);
    
    // 读取音频文件
    let audio_data = match fs::read(&audio_path) {
        Ok(data) => Bytes::from(data),
        Err(e) => {
            return Ok(SpeechRecognitionResult {
                success: false,
                text: None,
                error: Some(format!("读取音频文件失败: {}", e)),
                confidence: None,
            });
        }
    };
    
    let mut config = FlashRecognitionConfig::default();
    // 设置音频格式为支持webm/opus格式
    config.voice_format = "ogg-opus".to_string();
    
    match client.flash_recognize(audio_data, config).await {
        Ok(response) => {
            if response.code == 0 {
                let text = response.flash_result
                    .first()
                    .map(|r| r.text.clone())
                    .unwrap_or_default();
                
                Ok(SpeechRecognitionResult {
                    success: true,
                    text: Some(text),
                    error: None,
                    confidence: None, // 腾讯云API可能不直接返回置信度
                })
            } else {
                Ok(SpeechRecognitionResult {
                    success: false,
                    text: None,
                    error: Some(format!("语音识别失败: {}", response.message)),
                    confidence: None,
                })
            }
        }
        Err(e) => {
            Ok(SpeechRecognitionResult {
                success: false,
                text: None,
                error: Some(format!("语音识别错误: {}", e)),
                confidence: None,
            })
        }
    }
}

pub async fn perform_speech_recognition_from_base64(
    audio_base64: String,
    app_handle: &AppHandle,
) -> Result<SpeechRecognitionResult, String> {
    
    
    // 从配置系统获取腾讯云配置
    let speech_config = match get_speech_config(app_handle).await {
        Ok(config) => config,
        Err(_) => {
            return Ok(SpeechRecognitionResult {
                success: false,
                text: None,
                error: Some("请先在设置中配置腾讯云语音识别参数".to_string()),
                confidence: None,
            });
        }
    };
    
    let client = SpeechClient::new(
        speech_config.app_id, 
        speech_config.secret_id, 
        speech_config.secret_key, 
        speech_config.region
    );
    
    // 解码base64音频数据
    let audio_data = match general_purpose::STANDARD.decode(&audio_base64) {
        Ok(data) => Bytes::from(data),
        Err(e) => {
            return Ok(SpeechRecognitionResult {
                success: false,
                text: None,
                error: Some(format!("解码base64音频数据失败: {}", e)),
                confidence: None,
            });
        }
    };
    
    let mut config = FlashRecognitionConfig::default();
    // 设置音频格式为支持webm/opus格式
    config.voice_format = "ogg-opus".to_string();
    
    match client.flash_recognize(audio_data, config).await {
        Ok(response) => {
            if response.code == 0 {
                let text = response.flash_result
                    .first()
                    .map(|r| r.text.clone())
                    .unwrap_or_default();
                
                Ok(SpeechRecognitionResult {
                    success: true,
                    text: Some(text),
                    error: None,
                    confidence: None, // 腾讯云API可能不直接返回置信度
                })
            } else {
                Ok(SpeechRecognitionResult {
                    success: false,
                    text: None,
                    error: Some(format!("语音识别失败: {}", response.message)),
                    confidence: None,
                })
            }
        }
        Err(e) => {
            Ok(SpeechRecognitionResult {
                success: false,
                text: None,
                error: Some(format!("语音识别错误: {}", e)),
                confidence: None,
            })
        }
    }
}

#[command]
pub async fn execute_accuracy_test_with_message(
    test_id: String,
    audio_base64: String,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<AccuracyTest, String> {
    let test_id_for_db = test_id.clone();
    let test_id_for_update = test_id.clone();
    let test_id_for_final = test_id.clone();
    
    // 获取测试记录
    let test = database.with_db(|db| {
        let test_id = test_id_for_db.clone();
        let fut = async move {
            db.get_accuracy_test_by_id(&test_id).await
                .map_err(|e| format!("获取测试记录失败: {}", e))?
                .ok_or_else(|| "测试记录不存在".to_string())
        };
        Box::pin(fut)
    }).await?;
    
    // 执行Python代码生成期望文本和IoT消息
    let (expected_text, iot_message) = if test.mode == "code" && test.python_code.is_some() {
        let code = test.python_code.as_ref().unwrap();
        
        // 执行Python代码同时获取IoT参数和期望文本
        let result = match execute_accuracy_test_python_code(code.clone(), app_handle.clone()).await {
            Ok(result) => result,
            Err(e) => {
                let error_msg = format!("执行Python代码失败: {}", e);
                let db_guard = database.0.lock().await;
                if let Some(db) = db_guard.as_ref() {
                    let _ = db.update_accuracy_test_result(
                    &test_id_for_update,
                    "",
                    0.0,
                    "failed",
                    Utc::now(),
                    Some(&error_msg),
                    None, // 失败时不保存音频数据
                    None  // 失败时不保存音频时长
                ).await;
                }
                return Err(error_msg);
            }
        };

        if !result.success {
            let error_msg = format!("Python代码执行失败: {}", 
                result.error.unwrap_or_else(|| "未知错误".to_string()));
            let db_guard = database.0.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let _ = db.update_accuracy_test_result(
                    &test_id_for_update,
                    "",
                    0.0,
                    "failed",
                    Utc::now(),
                    Some(&error_msg),
                    None, // 失败时不保存音频数据
                    None  // 失败时不保存音频时长
                ).await;
            }
            return Err(error_msg);
        }
        
        let expected = result.expected_text.unwrap_or(test.expected_text.clone());
        let iot_params = result.result;
        
        // 添加调试日志
        if let Some(ref params) = iot_params {
            // 解析payload来验证一致性
            if let Ok(payload_json) = serde_json::from_str::<serde_json::Value>(&params.payload) {
                if let Some(amount) = payload_json.get("amount").and_then(|v| v.as_i64()) {
                    let amount_yuan = amount as f64 / 100.0;
                    Logger::info(&app_handle, &format!("Python执行结果 - 期望文本: {}, IoT金额: {}分 ({}元)", expected, amount, amount_yuan), "AccuracyTest");
                }
            }
        }
        
        (expected, iot_params)
    } else {
        (test.expected_text.clone(), None)
    };
    
    // 发送IoT消息
    if let Some(iot_params) = iot_message {
        // 先更新数据库中的期望文本（如果是代码模式生成的）
        if test.mode == "code" {
            let db_guard = database.0.lock().await;
            if let Some(db) = db_guard.as_ref() {
                if let Err(e) = db.update_accuracy_test_expected_text(
                    &test_id_for_update,
                    &expected_text,
                    "running"
                ).await {
                    let error_msg = format!("更新测试期望文本失败: {}", e);
                    Logger::warn(&app_handle, &error_msg, "AccuracyTest");
                } else {
                    Logger::info(&app_handle, &format!("数据库期望文本已更新为: {}", expected_text), "AccuracyTest");
                }
            }
        }
        
        match crate::iot_message::send_iot_message_with_precomputed_params(
            app_handle.clone(),
            database.clone(),
            iot_params.topic,
            iot_params.qos_level,
            iot_params.payload,
            iot_params.product_key,
            iot_params.device_name,
            Some("accuracy_test".to_string()),
            test.python_code.clone(),
            Some(true), // 使用预计算参数，避免重新执行Python代码
        ).await {
            Ok(_) => {
                // IoT消息发送成功，继续进行语音识别
            }
            Err(e) => {
                let error_msg = format!("发送IoT消息失败: {}", e);
                let db_guard = database.0.lock().await;
                if let Some(db) = db_guard.as_ref() {
                    let _ = db.update_accuracy_test_result(
                    &test_id_for_update,
                    "",
                    0.0,
                    "failed",
                    Utc::now(),
                    Some(&error_msg),
                    None, // 失败时不保存音频数据
                    None  // 失败时不保存音频时长
                ).await;
                }
                return Err(error_msg);
            }
        }
    }
    
    // 进行语音识别
    let recognition_result = perform_speech_recognition_from_base64(audio_base64.clone(), &app_handle).await?;
    
    let (recognized_text, similarity, result_status, error_message) = if recognition_result.success {
        let recognized = recognition_result.text.unwrap_or_default();
        let similarity = calculate_similarity(&expected_text, &recognized);
        let status = if similarity >= 0.8 { "passed" } else { "failed" };
        (recognized, similarity, status.to_string(), None)
    } else {
        (String::new(), 0.0, "failed".to_string(), recognition_result.error)
    };
    
    // 更新测试结果
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_accuracy_test_result(
            &test_id_for_final,
            &recognized_text,
            similarity,
            &result_status,
            Utc::now(),
            error_message.as_deref(),
            Some(&audio_base64), // 保存音频数据
            None // TODO: 添加音频时长计算
        ).await.map_err(|e| format!("更新测试结果失败: {}", e))?;
        
        // 获取更新后的测试记录
        match db.get_accuracy_test_by_id(&test_id_for_final).await {
            Ok(Some(updated_test)) => {
                // 发送事件通知前端
                let _ = app_handle.emit("accuracy_test_completed", &updated_test);
                Ok(updated_test)
            }
            Ok(None) => Err("测试记录不存在".to_string()),
            Err(e) => Err(format!("获取更新后的测试记录失败: {}", e)),
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[command]
pub async fn execute_accuracy_test_python_code(
    code: String,
    app_handle: AppHandle,
) -> Result<PythonExecutionResult, String> {
    crate::python_executor::execute_python_code_for_accuracy_test(&app_handle, code).await
}

#[command]
pub async fn get_accuracy_test_python_template() -> Result<String, String> {
    Ok(r#"import random
import datetime
import json
import time

def generate_message():
    """
    生成IoT消息参数和期望的语音播报文本
    基于IoT支付场景生成各种支付类型的消息
    支持变量替换：${PRODUCT_KEY}, ${DEVICE_NAME} 等
    
    返回格式:
    {
        "topic": "string",        # IoT主题路径
        "qos_level": int,         # QoS等级 (0, 1, 2)
        "payload": "string",      # JSON格式的消息内容
        "product_key": "string",  # 产品密钥
        "device_name": "string",  # 设备名称
        "expected_text": "string" # 期望的语音播报文本
    }
    """
    
    # 使用变量替换 - 这些变量将在执行时自动替换为实际值
    product_key = "${PRODUCT_KEY}"  # 阿里云IoT产品密钥
    device_name = "${DEVICE_NAME}"  # 设备名称
    
    # 如果变量未被替换（仍为占位符格式），使用默认值
    if not product_key or product_key.startswith("${") and product_key.endswith("}"):
        product_key = "a1WvzjC1YpQ"  # 默认产品密钥
    
    if not device_name or device_name.startswith("${") and device_name.endswith("}"):
        device_name = "your_device_name"  # 默认设备名称
    
    # 支付类型映射（与IoT消息中的payType对应）
    pay_types = {
        0: "通用",           # 通用（播报自定义前缀）
        1: "支付宝",
        2: "微信",
        3: "云闪付",
        4: "余额支付", 
        5: "微信储值",
        6: "微信买单",
        7: "银联刷卡",
        8: "会员卡消费",
        9: "会员卡充值",
        10: "用户取消支付",  # 防逃单播报
        12: "星驿付收款",
        13: "邮驿付收款",
        24: "数字人民币"
    }
    
    # 随机选择支付类型
    pay_type_id = random.choice(list(pay_types.keys()))
    
    # 生成随机金额（1.00-9999.99元）
    amount_cents = random.randint(100, 999999)  # 以分为单位
    
    # 可能的后缀消息
    suffix_options = [
        "",  # 无后缀
        "推荐使用支付宝",
        "推荐使用微信",
        "推荐使用云闪付APP",
        "推荐使用云闪付APP支付首单最高9折",
        "满178减43",
        "随机立减6元",
        "会员特享",
        "新人专享",
        "随机立减47元 新人专享"
    ]
    
    # 随机选择是否添加后缀（70%概率添加）
    suffix = ""
    suffix_flag = 0
    if random.random() < 0.7:
        non_empty_suffixes = [s for s in suffix_options if s]  # 排除空字符串
        if non_empty_suffixes:
            suffix = random.choice(non_empty_suffixes)
            suffix_flag = 1
    
    # 生成随机消息ID（10-16位数字）
    message_id = str(random.randint(1000000000, 9999999999999999))
    
    # 获取当前时间戳（毫秒）
    current_time = int(time.time() * 1000)
    
    # 构建IoT消息payload
    payload_data = {
        "vol": random.randint(30, 100),          # 音量 30-100
        "amount": amount_cents,                  # 金额（分）
        "payType": pay_type_id,                 # 支付类型
        "messageId": message_id,                # 消息ID
        "time": current_time,                   # 时间戳
        "preSuffix": 1,                         # 前缀开关
        "suffix": suffix_flag,                  # 后缀开关
        "suffixMsg": suffix                     # 后缀消息
    }
    
    # 生成期望的语音播报文本（基于相同的参数）
    pay_type_name = pay_types.get(pay_type_id, "未知支付类型")
    
    # 计算金额（元）
    amount_yuan = amount_cents / 100.0
    
    # 将金额转换为中文数字格式（标准化处理）
    yuan_int = int(amount_yuan)
    decimal = round((amount_yuan - yuan_int) * 100)
    
    # 数字到中文的映射
    num_map = {
        0: "零", 1: "一", 2: "二", 3: "三", 4: "四",
        5: "五", 6: "六", 7: "七", 8: "八", 9: "九"
    }
    
    # 处理整数部分
    if yuan_int == 0:
        amount_text = "零"
    else:
        # 分解数字
        wan = yuan_int // 10000
        qian = (yuan_int % 10000) // 1000
        bai = (yuan_int % 1000) // 100
        shi = (yuan_int % 100) // 10
        ge = yuan_int % 10
        
        amount_text = ""
        
        # 处理万位
        if wan > 0:
            if wan == 2:
                amount_text += "二万"
            else:
                amount_text += num_map[wan] + "万"
            # 处理千位
            if qian > 0:
                if qian == 2:
                    amount_text += "二千"
                else:
                    amount_text += num_map[qian] + "千"
            elif bai > 0 or shi > 0 or ge > 0:
                amount_text += "零"
        
        # 处理千位（无万位时）
        elif qian > 0:
            if qian == 2:
                amount_text += "二千"
            else:
                amount_text += num_map[qian] + "千"
        
        # 处理百位
        if bai > 0:
            if bai == 2:
                amount_text += "二百"
            else:
                amount_text += num_map[bai] + "百"
            # 处理十位
            if shi > 0:
                amount_text += num_map[shi] + "十"
            elif ge > 0:
                amount_text += "零"
        elif qian > 0 and (shi > 0 or ge > 0):
            amount_text += "零"
        
        # 处理十位（无百位时）
        elif shi > 0:
            if shi == 1:
                amount_text += "十"
            else:
                amount_text += num_map[shi] + "十"
        
        # 处理个位
        if ge > 0:
            if ge == 2 and shi == 0 and bai == 0 and qian == 0 and wan == 0:
                amount_text += "二"
            else:
                amount_text += num_map[ge]
    
    # 处理小数部分
    if decimal > 0:
        amount_text += "点"
        # 转换为二位数字的字符串，确保始终有二位
        decimal_str = f"{decimal:02d}"
        # 读出每一位数字
        for digit in decimal_str:
            amount_text += num_map[int(digit)]
    
    # 添加单位
    amount_text += "元"
    
    # 生成基础播报文本（基于payType）
    if pay_type_id == 0:  # 通用（播报自定义前缀）
        base_text = f"通用收款{amount_text}"
    elif pay_type_id == 1:  # 支付宝
        base_text = f"支付宝收款{amount_text}"
    elif pay_type_id == 2:  # 微信
        base_text = f"微信收款{amount_text}"
    elif pay_type_id == 3:  # 云闪付
        base_text = f"云闪付收款{amount_text}"
    elif pay_type_id == 4:  # 余额支付
        base_text = f"余额支付收款{amount_text}"
    elif pay_type_id == 5:  # 微信储值
        base_text = f"微信储值收款{amount_text}"
    elif pay_type_id == 6:  # 微信买单
        base_text = f"微信买单收款{amount_text}"
    elif pay_type_id == 7:  # 银联刷卡
        base_text = f"银联刷卡收款{amount_text}"
    elif pay_type_id == 8:  # 会员卡消费
        base_text = f"会员卡消费收款{amount_text}"
    elif pay_type_id == 9:  # 会员卡充值
        base_text = f"会员卡充值收款{amount_text}"
    elif pay_type_id == 10:  # 防逃单播报
        base_text = "用户取消支付"  # 特殊处理，不包含金额
    elif pay_type_id == 12:  # 星驿付收款
        base_text = f"星驿付收款{amount_text}"
    elif pay_type_id == 13:  # 邮驿付收款  
        base_text = f"邮驿付收款{amount_text}"
    elif pay_type_id == 24:  # 数字人民币
        base_text = f"数字人民币收款{amount_text}"
    else:
        # 其他支付类型
        base_text = f"{pay_type_name}收款{amount_text}"
    
    # 根据payload中的suffixMsg添加后缀
    # 注意：payType=10（用户取消支付）通常不添加后缀
    if pay_type_id == 10:
        expected_text = base_text  # 用户取消支付不添加后缀
    elif suffix and suffix.strip():
        expected_text = f"{base_text} {suffix}"
    else:
        expected_text = base_text
    
    # 标准化期望文本：去除空格和标点符号，统一格式
    import re
    # 移除所有标点符号和空格
    expected_text_clean = re.sub(r'[^\w]', '', expected_text)
    # 将英文字母转为大写（如果有的话）
    expected_text_clean = expected_text_clean.upper()
    
    # 统一支付方式表述
    payment_aliases = {
        '支付宝支付': '支付宝',
        '微信支付': '微信',
        '云闪付支付': '云闪付',
        'APP支付': 'APP',
        'APPAPP': 'APP',  # 修复重复的APP
    }
    
    for old, new in payment_aliases.items():
        expected_text_clean = expected_text_clean.replace(old, new)
    
    # 使用标准化后的文本作为最终的期望文本
    expected_text = expected_text_clean
    
    return {
        "topic": f"/{product_key}/{device_name}/user/service/voiceBroadcast",
        "qos_level": 1,
        "payload": json.dumps(payload_data, ensure_ascii=False),
        "product_key": product_key,
        "device_name": device_name,
        "expected_text": expected_text
    }

# 测试函数 - 生成多个示例
def generate_test_samples(count=5):
    """生成多个测试样例"""
    samples = []
    for i in range(count):
        message = generate_message()
        
        samples.append(f"{i+1}. 期望文本: {message['expected_text']}")
        samples.append(f"   IoT消息: {message['topic']}")
        samples.append(f"   Payload: {message['payload']}")
        samples.append("")
    return "\n".join(samples)

# 变量使用示例：
# 在代码中可以使用以下变量格式（不区分大小写）：
# ${PRODUCT_KEY}  - 产品密钥
# ${DEVICE_NAME}  - 设备名称
# ${自定义变量名}  - 自定义变量
#
# 这些变量在执行时会自动替换为在变量管理中设置的值

# 主函数用于测试
if __name__ == "__main__":
    print("=== 语音播报准确性测试示例 ===")
    print(generate_test_samples(3))
    print("\n=== 单次生成结果 ===")
    message = generate_message()
    print(f"期望文本: {message['expected_text']}")
    print(f"IoT消息主题: {message['topic']}")
    print(f"QoS等级: {message['qos_level']}")
    print(f"消息内容: {message['payload']}")

# 注意: 不要修改下面的代码
if __name__ == "__main__":
    try:
        result = generate_message()
        print("RESULT:", json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print("ERROR:", str(e))
"#.to_string())
}

#[command]
pub async fn execute_accuracy_test_with_params(
    test_id: String,
    audio_base64: String,
    iot_topic: String,
    iot_qos_level: i32,
    iot_payload: String,
    iot_product_key: String,
    iot_device_name: String,
    expected_text: String,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<AccuracyTest, String> {
    let test_id_for_db = test_id.clone();
    let test_id_for_update = test_id.clone();
    let test_id_for_final = test_id.clone();
    
    // 获取测试记录
    let test = database.with_db(|db| {
        let test_id = test_id_for_db.clone();
        let fut = async move {
            db.get_accuracy_test_by_id(&test_id).await
                .map_err(|e| format!("获取测试记录失败: {}", e))?
                .ok_or_else(|| "测试记录不存在".to_string())
        };
        Box::pin(fut)
    }).await?;
    
    // 使用预先计算的IoT参数发送消息
    match crate::iot_message::send_iot_message(
        app_handle.clone(),
        database.clone(),
        iot_topic,
        iot_qos_level,
        iot_payload,
        iot_product_key,
        iot_device_name,
        Some("accuracy_test".to_string()),
        test.python_code.clone(),
    ).await {
        Ok(_) => {
            // IoT消息发送成功，继续进行语音识别
        }
        Err(e) => {
            let error_msg = format!("发送IoT消息失败: {}", e);
            let db_guard = database.0.lock().await;
            if let Some(db) = db_guard.as_ref() {
                let _ = db.update_accuracy_test_result(
                    &test_id_for_update,
                    "",
                    0.0,
                    "failed",
                    Utc::now(),
                    Some(&error_msg),
                    None, // 失败时不保存音频数据
                    None  // 失败时不保存音频时长
                ).await;
            }
            return Err(error_msg);
        }
    }
    
    // 进行语音识别
    let recognition_result = perform_speech_recognition_from_base64(audio_base64.clone(), &app_handle).await?;
    
    let (recognized_text, similarity, result_status, error_message) = if recognition_result.success {
        let recognized = recognition_result.text.unwrap_or_default();
        let similarity = calculate_similarity(&expected_text, &recognized);
        let status = if similarity >= 0.8 { "passed" } else { "failed" };
        (recognized, similarity, status.to_string(), None)
    } else {
        (String::new(), 0.0, "failed".to_string(), recognition_result.error)
    };
    
    // 更新测试结果
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_accuracy_test_result(
            &test_id_for_final,
            &recognized_text,
            similarity,
            &result_status,
            Utc::now(),
            error_message.as_deref(),
            Some(&audio_base64), // 保存音频数据
            None // TODO: 添加音频时长计算
        ).await.map_err(|e| format!("更新测试结果失败: {}", e))?;
        
        // 获取更新后的测试记录
        match db.get_accuracy_test_by_id(&test_id_for_final).await {
            Ok(Some(updated_test)) => {
                // 发送事件通知前端
                let _ = app_handle.emit("accuracy_test_completed", &updated_test);
                Ok(updated_test)
            }
            Ok(None) => Err("测试记录不存在".to_string()),
            Err(e) => Err(format!("获取更新后的测试记录失败: {}", e)),
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[command]
pub async fn execute_accuracy_test_with_params_precomputed(
    test_id: String,
    audio_base64: String,
    iot_topic: String,
    iot_qos_level: i32,
    iot_payload: String,
    iot_product_key: String,
    iot_device_name: String,
    expected_text: String,
    use_precomputed: Option<bool>,
    python_code: Option<String>,
    audio_duration: Option<i64>,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<AccuracyTest, String> {
    let test_id_for_db = test_id.clone();
    let test_id_for_log = test_id.clone();
    let test_id_for_update = test_id.clone();
    
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "AccuracyTest"),
            "warn" => Logger::warn(&app_handle, message, "AccuracyTest"),
            "error" => Logger::error(&app_handle, message, "AccuracyTest"),
            "debug" => Logger::debug(&app_handle, message, "AccuracyTest"),
            _ => Logger::info(&app_handle, message, "AccuracyTest"),
        }
    };

    send_log("info", &format!("开始执行准确性测试: {}", test_id_for_log));

    // 从数据库获取测试记录
    let mut test = database.with_db(|db| {
        let test_id = test_id_for_db.clone();
        let fut = async move {
            db.get_accuracy_test_by_id(&test_id).await
                .map_err(|e| format!("获取测试记录失败: {}", e))?
                .ok_or_else(|| "测试记录不存在".to_string())
        };
        Box::pin(fut)
    }).await?;

    // 确定最终使用的IoT参数和期望文本
    let (final_topic, final_qos_level, final_payload, final_product_key, final_device_name, final_expected_text) = 
        if test.mode == "code" && !use_precomputed.unwrap_or(false) {
            // 代码模式且未使用预计算参数，执行Python代码
            if let Some(python_code) = &python_code {
                send_log("info", "代码模式：执行Python代码获取参数");
                
                // 执行Python代码获取期望文本
                let expected_result = match execute_accuracy_test_python_code(python_code.clone(), app_handle.clone()).await {
                    Ok(result) => result,
                    Err(e) => {
                        let error_msg = format!("执行generate_expected_text()失败: {}", e);
                        send_log("error", &error_msg);
                        return Err(error_msg);
                    }
                };

                if !expected_result.success {
                    let error_msg = format!("生成期望文本失败: {}", 
                        expected_result.error.unwrap_or_else(|| "未知错误".to_string()));
                    send_log("error", &error_msg);
                    return Err(error_msg);
                }

                let expected_text = expected_result.expected_text.unwrap_or_default();

                // 执行Python代码获取IoT参数
                let iot_result = crate::python_executor::execute_python_code_async(&app_handle, python_code).await;
                
                if !iot_result.success {
                    let error_msg = format!("执行generate_message()失败: {}", 
                        iot_result.error.unwrap_or_else(|| "未知错误".to_string()));
                    send_log("error", &error_msg);
                    return Err(error_msg);
                }
                
                let iot_params = iot_result.result.ok_or_else(|| {
                    let error_msg = "Python代码未返回有效的IoT参数";
                    send_log("error", error_msg);
                    error_msg.to_string()
                })?;
                
                send_log("info", "Python代码执行成功，使用生成的参数");
                (iot_params.topic, iot_params.qos_level, iot_params.payload, iot_product_key, iot_device_name, expected_text)
            } else {
                send_log("warn", "代码模式但缺少Python代码，使用传入参数");
                (iot_topic, iot_qos_level, iot_payload, iot_product_key, iot_device_name, expected_text)
            }
        } else {
            if use_precomputed.unwrap_or(false) {
                send_log("info", "代码模式：使用预计算参数，保持原有期望文本不变");
            } else {
                send_log("info", "表单模式：使用传入参数");
            }
            // 使用预计算参数时，保持原有的期望文本不变
            (iot_topic, iot_qos_level, iot_payload, iot_product_key, iot_device_name, test.expected_text.clone())
        };

    send_log("info", &format!("IoT参数确定完成，期望文本: {}", final_expected_text));

    // 检查期望文本是否发生变化
    let should_update_expected_text = final_expected_text != test.expected_text;
    
    // 更新测试记录为运行中状态
    test.result = "running".to_string();
    
    // 根据是否需要更新期望文本来决定数据库操作
    {
        let db_guard = database.0.lock().await;
        if let Some(db) = db_guard.as_ref() {
            if should_update_expected_text {
                // 更新期望文本和状态
                if let Err(e) = db.update_accuracy_test_expected_text(
                    &test_id_for_update,
                    &final_expected_text,
                    "running"
                ).await {
                    let error_msg = format!("更新测试期望文本失败: {}", e);
                    send_log("error", &error_msg);
                    return Err(error_msg);
                }
                send_log("info", &format!("数据库期望文本已更新为: {}", final_expected_text));
                test.expected_text = final_expected_text.clone(); // 更新本地对象
            } else {
                // 只更新状态为运行中，保持期望文本不变
                if let Err(e) = db.update_accuracy_test_expected_text(
                    &test_id_for_update,
                    &test.expected_text, // 保持原有期望文本
                    "running"
                ).await {
                    let error_msg = format!("更新测试状态失败: {}", e);
                    send_log("error", &error_msg);
                    return Err(error_msg);
                }
                send_log("info", "测试状态已更新为运行中，期望文本保持不变");
            }
        }
    }

    // 检查是否有音频数据
    if audio_base64.is_empty() {
        // 没有音频数据，执行第一阶段：发送IoT消息并通知前端录音
        send_log("info", "第一阶段：发送IoT消息");
        
        // 发送IoT消息
        let iot_result = crate::iot_message::send_iot_message_with_precomputed_params(
            app_handle.clone(),
            database.clone(),
            final_topic,
            final_qos_level,
            final_payload,
            final_product_key,
            final_device_name,
            Some("accuracy_test".to_string()),
            python_code,
            Some(true), // 使用预计算参数
        ).await;

        // 先通知前端开始录音
        let _ = app_handle.emit("start_recording_for_test", &test_id);
        send_log("info", "已通知前端开始录音");
        
        // 延迟1秒后发送IoT消息
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        send_log("info", "录音延迟1秒后开始发送IoT消息");
        
        // 处理IoT发送结果
        match iot_result {
            Ok(_) => send_log("info", "IoT消息发送成功"),
            Err(e) => send_log("warn", &format!("IoT消息发送失败: {}", e)),
        }
        
        // 没有音频数据，直接返回测试记录，等待前端录音完成后再调用
        return Ok(test);
    } else {
        // 有音频数据，执行第二阶段：语音识别（或兼容旧的完整工作流程）
        send_log("info", "第二阶段：检测到音频数据，进行语音识别");
        
        // 如果是有音频数据的情况，也需要发送IoT消息（兼容旧流程）
        if test.mode == "form" || use_precomputed.unwrap_or(false) {
            send_log("info", "发送IoT消息（兼容旧流程）");
            let iot_result = crate::iot_message::send_iot_message_with_precomputed_params(
                app_handle.clone(),
                database.clone(),
                final_topic,
                final_qos_level,
                final_payload,
                final_product_key,
                final_device_name,
                Some("accuracy_test".to_string()),
                python_code.clone(),
                Some(true),
            ).await;
            
            match iot_result {
                Ok(_) => send_log("info", "IoT消息发送成功"),
                Err(e) => send_log("warn", &format!("IoT消息发送失败: {}", e)),
            }
        }
    }

    // 执行语音识别
    let recognition_result = perform_speech_recognition_from_base64(audio_base64.clone(), &app_handle).await?;

    let (recognized_text, similarity, result_status, error_message) = if recognition_result.success {
        let recognized = recognition_result.text.unwrap_or_default();
        let similarity = calculate_similarity(&final_expected_text, &recognized);
        let status = if similarity >= 0.8 { "passed" } else { "failed" };
        (recognized, similarity, status.to_string(), None)
    } else {
        (String::new(), 0.0, "failed".to_string(), recognition_result.error)
    };
    
    // 更新测试结果
    test.recognized_text = Some(recognized_text.clone());
    test.similarity = Some(similarity);
    test.result = result_status;
    test.completed_at = Some(Utc::now());
    test.error_message = error_message;

    send_log("info", &format!("测试完成，相似度: {:.2}%", similarity * 100.0));

    // 保存到数据库
    let db_guard = database.0.lock().await;
    if let Some(db) = db_guard.as_ref() {
        if let Err(e) = db.update_accuracy_test_result(
            &test_id_for_update,
            &recognized_text,
            similarity,
            &test.result,
            test.completed_at.unwrap(),
            test.error_message.as_deref(),
            Some(&audio_base64), // 保存录音的Base64数据
            audio_duration // 传递音频时长
        ).await {
            let error_msg = format!("更新测试记录失败: {}", e);
            send_log("error", &error_msg);
            return Err(error_msg);
        }
        
        // 获取更新后的测试记录并发送事件通知前端
        match db.get_accuracy_test_by_id(&test_id).await {
            Ok(Some(updated_test)) => {
                // 发送事件通知前端
                let _ = app_handle.emit("accuracy_test_completed", &updated_test);
                send_log("info", "已发送测试完成事件到前端");
                Ok(updated_test)
            }
            Ok(None) => {
                let error_msg = "测试记录不存在".to_string();
                send_log("error", &error_msg);
                Err(error_msg)
            }
            Err(e) => {
                let error_msg = format!("获取更新后的测试记录失败: {}", e);
                send_log("error", &error_msg);
                Err(error_msg)
            }
        }
    } else {
        let error_msg = "数据库未初始化".to_string();
        send_log("error", &error_msg);
        Err(error_msg)
    }
}