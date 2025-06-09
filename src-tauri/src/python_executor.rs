use pyo3::prelude::*;
use pyo3::types::{PyDict, PyString};
use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;
use std::io::Write;
use std::ffi::CString;
use tauri::{AppHandle, Manager};
use crate::iot_message::DatabaseState;
use crate::logger::Logger;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoTMessageParams {
    pub topic: String,
    pub qos_level: i32,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonExecutionResult {
    pub success: bool,
    pub result: Option<PythonExecutionResultData>,
    pub error: Option<String>,
    pub logs: Vec<String>,
    pub expected_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonExecutionResultData {
    pub topic: String,
    pub qos_level: i32,
    pub payload: String,
    pub product_key: String,
    pub device_name: String,
}

// 标准Python接口模板
pub const PYTHON_TEMPLATE: &str = r#"
# IoT 消息测试标准接口
# 请实现 generate_message 函数，返回包含 topic, qos_level, payload, product_key, device_name 的字典
# 支持变量替换：${PRODUCT_KEY}, ${DEVICE_NAME} 等

import json
import time
import random
from datetime import datetime

def generate_message():
    """
    生成IoT消息参数
    基于IoT支付场景生成各种支付类型的消息
    
    返回格式:
    {
        "topic": "string",        # IoT主题路径
        "qos_level": int,         # QoS等级 (0, 1, 2)
        "payload": "string",      # JSON格式的消息内容
        "product_key": "string",  # 产品密钥
        "device_name": "string"   # 设备名称
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
    
    # 生成随机金额（1.00-9999.99元，以分为单位）
    amount_cents = random.randint(100, 999999)
    
    # 生成随机消息ID（10-16位数字）
    message_id = str(random.randint(1000000000, 9999999999999999))
    
    # 获取当前时间戳（毫秒）
    current_time = int(time.time() * 1000)
    
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
    
    # 随机选择是否添加后缀（30%概率添加）
    suffix_msg = random.choice(suffix_options) if random.random() < 0.3 else ""
    
    # 构建IoT消息payload
    payload_data = {
        "vol": random.randint(30, 100),          # 音量 30-100
        "amount": amount_cents,                  # 金额（分）
        "payType": pay_type_id,                 # 支付类型
        "messageId": message_id,                # 消息ID
        "time": current_time,                   # 时间戳
        "preSuffix": 1,                         # 前缀开关
        "suffix": 1 if suffix_msg else 0,      # 后缀开关
        "suffixMsg": suffix_msg                 # 后缀消息
    }
    
    return {
        "topic": f"/{product_key}/{device_name}/user/service/voiceBroadcast",
        "qos_level": 1,
        "payload": json.dumps(payload_data, ensure_ascii=False),
        "product_key": product_key,
        "device_name": device_name
    }

# 测试函数 - 生成多个示例
def generate_test_samples(count=5):
    """生成多个测试样例"""
    samples = []
    for i in range(count):
        message = generate_message()
        samples.append(f"{i+1}. IoT消息: {message['topic']}")
        samples.append(f"   设备名称: {message['device_name']}")
        samples.append(f"   支付金额: {json.loads(message['payload'])['amount']/100:.2f}元")
        samples.append("")
    return samples

# 变量使用示例：
# 在代码中可以使用以下变量格式（不区分大小写）：
# ${PRODUCT_KEY}  - 产品密钥
# ${DEVICE_NAME}  - 设备名称
# ${自定义变量名}  - 自定义变量
#
# 这些变量在执行时会自动替换为在变量管理中设置的值

# 注意: 不要修改下面的代码
if __name__ == "__main__":
    try:
        result = generate_message()
        print("RESULT:", json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print("ERROR:", str(e))
"#;

// 发送日志到前端的辅助函数
fn send_log_to_frontend(app_handle: &AppHandle, level: &str, message: &str) {
    match level {
        "info" => Logger::info(app_handle, message, "Python"),
        "warn" => Logger::warn(app_handle, message, "Python"),
        "error" => Logger::error(app_handle, message, "Python"),
        "debug" => Logger::debug(app_handle, message, "Python"),
        _ => Logger::info(app_handle, message, "Python"),
    }
}

// 变量替换函数
async fn replace_variables(app_handle: &AppHandle, code: &str) -> Result<String, String> {
    // 获取数据库状态
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    let db = match db_guard.as_ref() {
        Some(database) => database,
        None => {
            send_log_to_frontend(app_handle, "warn", "数据库未初始化，跳过变量替换");
            return Ok(code.to_string());
        }
    };

    // 获取所有变量
    let variables = match db.get_all_variables().await {
        Ok(vars) => vars,
        Err(e) => {
            let error_msg = format!("获取变量列表失败: {}", e);
            send_log_to_frontend(app_handle, "error", &error_msg);
            return Err(error_msg);
        }
    };

    // 如果没有变量，直接返回
    if variables.is_empty() {
        return Ok(code.to_string());
    }

    let mut result = code.to_string();
    let mut replacements_made = 0;

    // 执行变量替换
    for variable in &variables {
        // 构造要查找的占位符模式 - 支持大小写不敏感
        let patterns = vec![
            format!("${{{}}}", variable.name),           // ${VARIABLE_NAME}
            format!("${{{}}}", variable.name.to_lowercase()), // ${variable_name}
            format!("${{{}}}", variable.name.to_uppercase()), // ${VARIABLE_NAME}
        ];
        
        for pattern in patterns {
            if result.contains(&pattern) {
                let old_result = result.clone();
                result = result.replace(&pattern, &variable.value);
                if old_result != result {
                    replacements_made += 1;
                    send_log_to_frontend(app_handle, "debug", &format!("替换变量: {} -> {}", pattern, variable.value));
                }
            }
        }
    }

    if replacements_made > 0 {
        send_log_to_frontend(app_handle, "info", &format!("变量替换完成，共替换 {} 个变量", replacements_made));
    }

    Ok(result)
}

// 异步版本的Python代码执行函数（支持变量替换）
pub async fn execute_python_code_async(app_handle: &AppHandle, code: &str) -> PythonExecutionResult {
    send_log_to_frontend(app_handle, "info", "开始执行Python代码（支持变量替换）");

    // 首先进行变量替换
    let processed_code = match replace_variables(app_handle, code).await {
        Ok(code) => code,
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(e),
                logs: vec![],
                expected_text: None,
            };
        }
    };

    // 创建临时文件保存处理后的Python代码
    let mut temp_file = match NamedTempFile::new() {
        Ok(file) => file,
        Err(e) => {
            let error_msg = format!("创建临时文件失败: {}", e);
            send_log_to_frontend(app_handle, "error", &error_msg);
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(error_msg),
                logs: vec![],
                expected_text: None,
            };
        }
    };

    // 写入处理后的Python代码
    if let Err(e) = temp_file.write_all(processed_code.as_bytes()) {
        let error_msg = format!("写入Python代码失败: {}", e);
        send_log_to_frontend(app_handle, "error", &error_msg);
        return PythonExecutionResult {
            success: false,
            result: None,
            error: Some(error_msg),
            logs: vec![],
            expected_text: None,
        };
    }

    let temp_path = temp_file.path().to_string_lossy().to_string();

    // 执行Python代码
    Python::with_gil(|py| {
        let _logs: Vec<String> = Vec::new();
        let result = execute_python_file(py, &temp_path);
        
        match &result {
            PythonExecutionResult { success: true, result: Some(params), .. } => {
                send_log_to_frontend(app_handle, "info", "Python代码执行成功");
                send_log_to_frontend(app_handle, "debug", &format!("生成参数: topic={}, qos={}, payload_len={}", 
                    params.topic, params.qos_level, params.payload.len()));
            }
            PythonExecutionResult { success: false, error: Some(err), .. } => {
                send_log_to_frontend(app_handle, "error", &format!("Python执行失败: {}", err));
            }
            _ => {
                send_log_to_frontend(app_handle, "warn", "Python执行结果异常");
            }
        }
        
        result
    })
}

pub fn execute_python_code(app_handle: &AppHandle, code: &str) -> PythonExecutionResult {
    // 为了保持向后兼容，保留同步版本但不支持变量替换
    send_log_to_frontend(app_handle, "info", "开始执行Python代码（不支持变量替换）");
    send_log_to_frontend(app_handle, "info", "提示：使用异步版本可支持变量替换功能");

    // 创建临时文件保存Python代码
    let mut temp_file = match NamedTempFile::new() {
        Ok(file) => file,
        Err(e) => {
            let error_msg = format!("创建临时文件失败: {}", e);
            send_log_to_frontend(app_handle, "error", &error_msg);
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(error_msg),
                logs: vec![],
                expected_text: None,
            };
        }
    };

    // 写入Python代码
    if let Err(e) = temp_file.write_all(code.as_bytes()) {
        let error_msg = format!("写入Python代码失败: {}", e);
        send_log_to_frontend(app_handle, "error", &error_msg);
        return PythonExecutionResult {
            success: false,
            result: None,
            error: Some(error_msg),
            logs: vec![],
            expected_text: None,
        };
    }

    let temp_path = temp_file.path().to_string_lossy().to_string();
    send_log_to_frontend(app_handle, "debug", &format!("Python文件路径: {}", temp_path));

    // 执行Python代码
    Python::with_gil(|py| {
        let _logs: Vec<String> = Vec::new();
        let result = execute_python_file(py, &temp_path);
        
        match &result {
            PythonExecutionResult { success: true, result: Some(params), .. } => {
                send_log_to_frontend(app_handle, "info", "Python代码执行成功");
                send_log_to_frontend(app_handle, "debug", &format!("生成参数: topic={}, qos={}, payload_len={}", 
                    params.topic, params.qos_level, params.payload.len()));
            }
            PythonExecutionResult { success: false, error: Some(err), .. } => {
                send_log_to_frontend(app_handle, "error", &format!("Python执行失败: {}", err));
            }
            _ => {
                send_log_to_frontend(app_handle, "warn", "Python执行结果异常");
            }
        }
        
        result
    })
}

fn execute_python_file(py: Python, file_path: &str) -> PythonExecutionResult {
    let mut logs = Vec::new();
    
    // 执行Python文件
    let globals = PyDict::new(py);
    globals.set_item("__name__", "__main__").unwrap();
    
    // 读取并执行Python代码
    let code = match std::fs::read_to_string(file_path) {
        Ok(content) => content,
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("读取Python文件失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 执行代码
    let c_code = match CString::new(code) {
        Ok(c_str) => c_str,
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("转换Python代码为CString失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };
    
    if let Err(e) = py.run(c_code.as_c_str(), Some(&globals), None) {
        return PythonExecutionResult {
            success: false,
            result: None,
            error: Some(format!("Python代码执行错误: {}", e)),
            logs,
            expected_text: None,
        };
    }

    // 调用generate_message函数
    let generate_message_fn = match globals.get_item("generate_message") {
        Ok(Some(func)) => func,
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("未找到generate_message函数".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取generate_message函数失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 执行函数
    let result = match generate_message_fn.call0() {
        Ok(result) => result,
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("调用generate_message函数失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 解析返回结果
    let result_dict = match result.downcast::<PyDict>() {
        Ok(dict) => dict,
        Err(_) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("generate_message函数必须返回字典类型".to_string()),
                logs,
                expected_text: None,
            };
        }
    };

    // 提取参数
    let topic = match result_dict.get_item("topic") {
        Ok(Some(value)) => match value.downcast::<PyString>() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("topic必须是字符串类型".to_string()),
                    logs,
                    expected_text: None,
                };
            }
        },
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("返回结果中缺少topic字段".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取topic字段失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    let qos_level = match result_dict.get_item("qos_level") {
        Ok(Some(value)) => match value.extract::<i32>() {
            Ok(qos) if qos >= 0 && qos <= 2 => qos,
            Ok(qos) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("qos_level必须是0-2之间的整数，当前值: {}", qos)),
                    logs,
                    expected_text: None,
                };
            }
            Err(_) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("qos_level必须是整数类型".to_string()),
                    logs,
                    expected_text: None,
                };
            }
        },
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("返回结果中缺少qos_level字段".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取qos_level字段失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    let payload = match result_dict.get_item("payload") {
        Ok(Some(value)) => match value.downcast::<PyString>() {
            Ok(s) => {
                let payload_str = s.to_string();
                // 验证payload是否为有效的JSON
                if let Err(e) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                    return PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some(format!("payload必须是有效的JSON字符串: {}", e)),
                        logs,
                        expected_text: None,
                    };
                }
                payload_str
            }
            Err(_) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("payload必须是字符串类型".to_string()),
                    logs,
                    expected_text: None,
                };
            }
        },
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("返回结果中缺少payload字段".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取payload字段失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 获取product_key字段
    let product_key = match result_dict.get_item("product_key") {
        Ok(Some(value)) => match value.downcast::<PyString>() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("product_key必须是字符串类型".to_string()),
                    logs,
                    expected_text: None,
                };
            }
        },
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("返回结果中缺少product_key字段".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取product_key字段失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 获取device_name字段
    let device_name = match result_dict.get_item("device_name") {
        Ok(Some(value)) => match value.downcast::<PyString>() {
            Ok(s) => s.to_string(),
            Err(_) => {
                return PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("device_name必须是字符串类型".to_string()),
                    logs,
                    expected_text: None,
                };
            }
        },
        Ok(None) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some("返回结果中缺少device_name字段".to_string()),
                logs,
                expected_text: None,
            };
        }
        Err(e) => {
            return PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("获取device_name字段失败: {}", e)),
                logs,
                expected_text: None,
            };
        }
    };

    // 尝试获取expected_text字段（可选）
    let expected_text = match result_dict.get_item("expected_text") {
        Ok(Some(value)) => match value.downcast::<PyString>() {
            Ok(s) => Some(s.to_string()),
            Err(_) => None, // 如果类型不对，忽略
        },
        Ok(None) => None, // 如果字段不存在，忽略
        Err(_) => None, // 如果获取失败，忽略
    };

    logs.push(format!("成功生成IoT消息参数: topic={}, qos={}, product_key={}, device_name={}", topic, qos_level, product_key, device_name));

    PythonExecutionResult {
        success: true,
        result: Some(PythonExecutionResultData {
            topic,
            qos_level,
            payload,
            product_key,
            device_name,
        }),
        error: None,
        logs,
        expected_text,
    }
}

// 为准确性测试添加专门的Python执行函数
pub async fn execute_python_code_for_accuracy_test(app_handle: &AppHandle, code: String) -> Result<PythonExecutionResult, String> {
    // 首先进行变量替换
    let processed_code = match replace_variables(app_handle, &code).await {
        Ok(code) => code,
        Err(e) => {
            return Ok(PythonExecutionResult {
                success: false,
                result: None,
                error: Some(e),
                logs: vec![],
                expected_text: None,
            });
        }
    };

    Python::with_gil(|py| {
        let logs: Vec<String> = Vec::new();
        
        // 创建全局变量字典
        let globals = PyDict::new(py);
        
        // 导入必要的模块
        let import_code = "import json\nimport uuid\nimport datetime\nimport random\nimport time";
        let c_import_code = match CString::new(import_code) {
            Ok(c_str) => c_str,
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("转换导入代码为CString失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };
        
        if let Err(e) = py.run(c_import_code.as_c_str(), Some(&globals), None) {
            return Ok(PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("导入模块失败: {}", e)),
                logs,
                expected_text: None,
            });
        }

        // 执行处理后的代码（包含变量替换）
        let c_code = match CString::new(processed_code) {
            Ok(c_str) => c_str,
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("转换Python代码为CString失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };
        
        if let Err(e) = py.run(c_code.as_c_str(), Some(&globals), None) {
            return Ok(PythonExecutionResult {
                success: false,
                result: None,
                error: Some(format!("Python代码执行错误: {}", e)),
                logs,
                expected_text: None,
            });
        }

        // 先调用generate_message函数确保数据被生成和保存
        let generate_message_fn = match globals.get_item("generate_message") {
            Ok(Some(func)) => func,
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("未找到generate_message函数".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取generate_message函数失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        // 执行generate_message函数并获取IoT参数
        let iot_result = match generate_message_fn.call0() {
            Ok(result) => result,
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("调用generate_message函数失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        // 解析IoT消息参数
        let result_dict = match iot_result.downcast::<PyDict>() {
            Ok(dict) => dict,
            Err(_) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("generate_message函数必须返回字典类型".to_string()),
                    logs,
                    expected_text: None,
                });
            }
        };

        // 提取IoT参数
        let topic = match result_dict.get_item("topic") {
            Ok(Some(value)) => match value.downcast::<PyString>() {
                Ok(s) => s.to_string(),
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("topic必须是字符串类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少topic字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取topic字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        let qos_level = match result_dict.get_item("qos_level") {
            Ok(Some(value)) => match value.extract::<i32>() {
                Ok(qos) if qos >= 0 && qos <= 2 => qos,
                Ok(qos) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some(format!("qos_level必须是0-2之间的整数，当前值: {}", qos)),
                        logs,
                        expected_text: None,
                    });
                }
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("qos_level必须是整数类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少qos_level字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取qos_level字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        let payload = match result_dict.get_item("payload") {
            Ok(Some(value)) => match value.downcast::<PyString>() {
                Ok(s) => {
                    let payload_str = s.to_string();
                    // 验证payload是否为有效的JSON
                    if let Err(e) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                        return Ok(PythonExecutionResult {
                            success: false,
                            result: None,
                            error: Some(format!("payload必须是有效的JSON字符串: {}", e)),
                            logs,
                            expected_text: None,
                        });
                    }
                    payload_str
                }
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("payload必须是字符串类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少payload字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取payload字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        let product_key = match result_dict.get_item("product_key") {
            Ok(Some(value)) => match value.downcast::<PyString>() {
                Ok(s) => s.to_string(),
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("product_key必须是字符串类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少product_key字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取product_key字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        let device_name = match result_dict.get_item("device_name") {
            Ok(Some(value)) => match value.downcast::<PyString>() {
                Ok(s) => s.to_string(),
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("device_name必须是字符串类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少device_name字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取device_name字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        // 获取expected_text字段
        let expected_text = match result_dict.get_item("expected_text") {
            Ok(Some(value)) => match value.downcast::<PyString>() {
                Ok(s) => s.to_string(),
                Err(_) => {
                    return Ok(PythonExecutionResult {
                        success: false,
                        result: None,
                        error: Some("expected_text必须是字符串类型".to_string()),
                        logs,
                        expected_text: None,
                    });
                }
            },
            Ok(None) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some("返回结果中缺少expected_text字段".to_string()),
                    logs,
                    expected_text: None,
                });
            }
            Err(e) => {
                return Ok(PythonExecutionResult {
                    success: false,
                    result: None,
                    error: Some(format!("获取expected_text字段失败: {}", e)),
                    logs,
                    expected_text: None,
                });
            }
        };

        // 直接返回结果，不需要再调用generate_expected_text函数
        Ok(PythonExecutionResult {
            success: true,
            result: Some(crate::python_executor::PythonExecutionResultData {
                topic,
                qos_level,
                payload,
                product_key,
                device_name,
            }),
            error: None,
            logs,
            expected_text: Some(expected_text),
        })
    })
}

#[tauri::command]
pub async fn send_iot_message_from_python(
    app_handle: AppHandle,
    database: tauri::State<'_, crate::iot_message::DatabaseState>,
    python_code: String,
) -> Result<String, String> {
    let send_log = |level: &str, message: &str| {
        match level {
            "info" => Logger::info(&app_handle, message, "Python"),
            "warn" => Logger::warn(&app_handle, message, "Python"),
            "error" => Logger::error(&app_handle, message, "Python"),
            "debug" => Logger::debug(&app_handle, message, "Python"),
            _ => Logger::info(&app_handle, message, "Python"),
        }
    };

    send_log("info", "开始执行Python代码并发送IoT消息（支持变量替换）");

    // 执行Python代码
    let result = execute_python_code_async(&app_handle, &python_code).await;
    
    if !result.success {
        let error_msg = format!("Python执行失败: {}", 
            result.error.unwrap_or_else(|| "未知错误".to_string()));
        send_log("error", &error_msg);
        return Err(error_msg);
    }

    let iot_params = match result.result {
        Some(params) => params,
        None => {
            let error_msg = "Python代码未返回有效结果";
            send_log("error", error_msg);
            return Err(error_msg.to_string());
        }
    };

    send_log("info", &format!("Python生成的IoT参数: topic={}, qos={}, product_key={}, device_name={}", 
        iot_params.topic, iot_params.qos_level, iot_params.product_key, iot_params.device_name));

    // 调用IoT消息发送
    crate::iot_message::send_iot_message(
        app_handle,
        database,
        iot_params.topic,
        iot_params.qos_level,
        iot_params.payload,
        iot_params.product_key,
        iot_params.device_name,
        Some("code".to_string()),
        Some(python_code),
    ).await
}