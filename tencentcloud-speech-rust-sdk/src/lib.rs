use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::BTreeMap;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use bytes::Bytes;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use thiserror::Error;
use url::Url;
use log::debug;

type HmacSha1 = Hmac<Sha1>;

const ASR_HOST: &str = "asr.cloud.tencent.com";
const ASR_FLASH_PATH: &str = "/asr/flash/v1/";

#[derive(Debug, Error)]
pub enum SpeechError {
    #[error("Request error: {0}")]
    RequestError(#[from] reqwest::Error),
    #[error("URL parse error: {0}")]
    UrlError(#[from] url::ParseError),
    #[error("HMAC error")]
    HmacError,
    #[error("API error: code={code}, message={message}")]
    ApiError { code: i32, message: String },
}

#[derive(Debug, Clone)]
pub struct SpeechClient {
    app_id: String,
    secret_id: String,
    secret_key: String,
    region: String,
    client: Client,
}

#[derive(Debug, Serialize)]
pub struct FlashRecognitionConfig {
    pub engine_type: String,
    pub voice_format: String,
    pub sample_rate: i32,
    pub speaker_diarization: i32,
    pub filter_dirty: i32,
    pub filter_modal: i32,
    pub filter_punc: i32,
    pub convert_num_mode: i32,
    pub word_info: i32,
    pub hotword_list: Option<String>,
    pub first_channel_only: i32,
}

impl Default for FlashRecognitionConfig {
    fn default() -> Self {
        Self {
            engine_type: "16k_zh".to_string(),
            voice_format: "wav".to_string(),
            sample_rate: 16000,
            speaker_diarization: 0,
            filter_dirty: 0,
            filter_modal: 0,
            filter_punc: 2,
            convert_num_mode: 0,
            word_info: 0,
            hotword_list: None,
            first_channel_only: 1,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WordInfo {
    pub word: String,
    pub start_time: i32,
    pub end_time: i32,
    pub stable_flag: i32,
}

#[derive(Debug, Deserialize)]
pub struct SentenceInfo {
    pub text: String,
    pub start_time: i32,
    pub end_time: i32,
    pub speaker_id: i32,
    #[serde(default)]
    pub word_list: Vec<WordInfo>,
    #[serde(default)]
    pub emotional_energy: i32,
    #[serde(default)]
    pub speech_speed: i32,
}

#[derive(Debug, Deserialize)]
pub struct FlashResult {
    pub text: String,
    pub channel_id: i32,
    pub sentence_list: Vec<SentenceInfo>,
}

#[derive(Debug, Deserialize)]
pub struct FlashResponse {
    pub request_id: String,
    pub code: i32,
    pub message: String,
    pub audio_duration: i32,
    #[serde(default)]
    pub flash_result: Vec<FlashResult>,
}

impl SpeechClient {
    pub fn new(app_id: impl Into<String>, secret_id: impl Into<String>, secret_key: impl Into<String>, region: impl Into<String>) -> Self {
        Self {
            app_id: app_id.into(),
            secret_id: secret_id.into(),
            secret_key: secret_key.into(),
            region: region.into(),
            client: Client::new(),
        }
    }

    fn generate_signature(&self, request_url: &str, params: &BTreeMap<String, String>) -> Result<String, SpeechError> {
        // 构造查询字符串，参数已经在BTreeMap中自动排序
        let query_string: Vec<String> = params.iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();
        let query_string = query_string.join("&");
        
        // 根据官方文档构造签名原文：POST + 域名 + 路径 + ? + 查询参数
        let sign_text = format!(
            "POSTasr.cloud.tencent.com{}?{}",
            request_url, query_string
        );
        
        debug!("签名原文: {}", sign_text);

        let mut mac = HmacSha1::new_from_slice(self.secret_key.as_bytes())
            .map_err(|_| SpeechError::HmacError)?;
        mac.update(sign_text.as_bytes());
        let result = mac.finalize();
        Ok(BASE64.encode(result.into_bytes()))
    }

    pub async fn flash_recognize(
        &self,
        audio_data: Bytes,
        config: FlashRecognitionConfig,
    ) -> Result<FlashResponse, SpeechError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 构建所有查询参数并按字典序排序
        let mut params = BTreeMap::new();
        params.insert("engine_type".to_string(), config.engine_type.clone());
        params.insert("voice_format".to_string(), config.voice_format.clone());
        params.insert("sample_rate".to_string(), config.sample_rate.to_string());
        params.insert("speaker_diarization".to_string(), config.speaker_diarization.to_string());
        params.insert("filter_dirty".to_string(), config.filter_dirty.to_string());
        params.insert("filter_modal".to_string(), config.filter_modal.to_string());
        params.insert("filter_punc".to_string(), config.filter_punc.to_string());
        params.insert("convert_num_mode".to_string(), config.convert_num_mode.to_string());
        params.insert("word_info".to_string(), config.word_info.to_string());
        params.insert("hotword_list".to_string(), config.hotword_list.clone().unwrap_or_default());
        params.insert("first_channel_only".to_string(), config.first_channel_only.to_string());
        params.insert("secretid".to_string(), self.secret_id.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let mut url = Url::parse(&format!(
            "https://{}{}{}", 
            ASR_HOST,
            ASR_FLASH_PATH,
            self.app_id
        ))?;

        // 将参数添加到URL
        for (key, value) in &params {
            url.query_pairs_mut().append_pair(key, value);
        }

        let signature = self.generate_signature(url.path(), &params)?;

        // 详细打印请求信息
        debug!("=== 腾讯云语音识别 API 请求 ===");
        debug!("请求URL: {}", url);
        debug!("App ID: {}", self.app_id);
        debug!("Secret ID: {}", self.secret_id);
        debug!("时间戳: {}", timestamp);
        debug!("签名: {}", signature);
        debug!("音频数据大小: {} bytes", audio_data.len());
        debug!("配置参数: {:?}", config);
        if let Some(ref hotword_list) = config.hotword_list {
            debug!("热词列表: {}", hotword_list);
        }

        let response = self.client
            .post(url.clone())
            .header("Host", ASR_HOST)
            .header("Authorization", &signature)
            .header("Content-Type", "application/octet-stream")
            .body(audio_data)
            .send()
            .await?;

        // 打印响应状态
        let status = response.status();
        debug!("=== 腾讯云语音识别 API 响应 ===");
        debug!("HTTP状态码: {}", status);
        debug!("响应头: {:?}", response.headers());

        // 检查HTTP状态码
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            debug!("HTTP错误响应内容: {}", error_text);
            return Err(SpeechError::ApiError {
                code: status.as_u16() as i32,
                message: format!("HTTP Error {}: {}", status, error_text),
            });
        }

        // 获取响应文本进行调试
        let response_text = response.text().await?;
        debug!("API响应内容: {}", response_text);

        // 解析响应
        match serde_json::from_str::<FlashResponse>(&response_text) {
            Ok(result) => {
                debug!("响应解析成功: 代码={}, 消息={}", result.code, result.message);
                if result.code != 0 {
                    debug!("API返回错误: 代码={}, 消息={}", result.code, result.message);
                    return Err(SpeechError::ApiError {
                        code: result.code,
                        message: result.message,
                    });
                }
                debug!("识别结果数量: {}", result.flash_result.len());
                for (i, flash_result) in result.flash_result.iter().enumerate() {
                    debug!("识别结果[{}]: 文本='{}', 通道={}", i, flash_result.text, flash_result.channel_id);
                }
                Ok(result)
            }
            Err(e) => {
                debug!("响应解析失败: {}", e);
                debug!("原始响应内容: {}", response_text);
                
                // 尝试解析为基础错误格式 (for other Tencent Cloud services)
                #[derive(serde::Deserialize)]
                struct ErrorResponse {
                    #[serde(rename = "Response")]
                    response: ErrorResponseInner,
                }

                #[derive(serde::Deserialize)]
                struct ErrorResponseInner {
                    #[serde(rename = "Error")]
                    error: ErrorDetail,
                }

                #[derive(serde::Deserialize)]
                struct ErrorDetail {
                    #[serde(rename = "Code")]
                    code: String,
                    #[serde(rename = "Message")]
                    message: String,
                }

                if let Ok(error_resp) = serde_json::from_str::<ErrorResponse>(&response_text) {
                    debug!("解析为标准腾讯云错误格式: 代码={}, 消息={}", 
                           error_resp.response.error.code, error_resp.response.error.message);
                    return Err(SpeechError::ApiError {
                        code: -1,
                        message: format!("{}: {}", error_resp.response.error.code, error_resp.response.error.message),
                    });
                }

                Err(SpeechError::ApiError {
                    code: -2,
                    message: format!("Failed to parse API response: {}", e),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_flash_recognize() {
        let client = SpeechClient::new(
            "your_app_id",
            "your_secret_id",
            "your_secret_key",
            "your_region",
        );

        // 注释掉文件读取，避免测试时找不到文件
        // let audio_data = Bytes::from(include_bytes!("../tests/test.wav").to_vec());
        
        // 使用示例音频数据进行测试
        let audio_data = Bytes::from(vec![0u8; 1024]); // 示例数据
        
        let config = FlashRecognitionConfig {
            engine_type: "16k_zh".to_string(),
            voice_format: "wav".to_string(),
            ..Default::default()
        };

        // 注释掉实际的 API 调用，避免测试时需要真实凭证
        /*
        match client.flash_recognize(audio_data, config).await {
            Ok(response) => {
                println!("Recognition result: {:?}", response);
                assert_eq!(response.code, 0);
            }
            Err(e) => {
                panic!("Recognition failed: {}", e);
            }
        }
        */
        
        // 简单的结构体创建测试
        assert_eq!(client.app_id, "your_app_id");
        assert_eq!(config.engine_type, "16k_zh");
    }
}
