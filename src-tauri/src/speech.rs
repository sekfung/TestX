use tencentcloud_speech_rust_sdk::{SpeechClient, FlashRecognitionConfig};
use tauri::command;
use bytes::Bytes;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use log::{info, error, debug, warn};
use crate::config::{get_speech_config, get_recognition_config, get_hotword_config};

// 检查引擎是否支持热词功能
fn is_hotword_supported(engine_type: &str) -> bool {
    match engine_type {
        "8k_zh" | "16k_zh" | "8k_zh_large" | "16k_zh_large" |
        "16k_zh_dialect" | "16k_ca" => true,
        _ => false,
    }
}

#[command]
pub async fn recognize_speech(app_handle: tauri::AppHandle, audio_base64: String) -> Result<String, String> {
    info!("开始语音识别处理");
    
    // 从本地配置获取腾讯云配置、识别设置和热词配置
    let speech_config = match get_speech_config(&app_handle).await {
        Ok(config) => config,
        Err(e) => {
            let error_msg = if e.contains("未设置") {
                "语音识别配置未设置。请前往【设置】->【语音识别】页面配置腾讯云语音识别服务的AppID、SecretId和SecretKey信息".to_string()
            } else {
                format!("获取语音配置失败: {}", e)
            };
            error!("{}", error_msg);
            return Err(error_msg);
        }
    };
    
    let recognition_config = match get_recognition_config(&app_handle).await {
        Ok(config) => config,
        Err(e) => {
            let error_msg = format!("获取识别配置失败: {}", e);
            error!("{}", error_msg);
            return Err(error_msg);
        }
    };
    
    let hotword_config = match get_hotword_config(&app_handle).await {
        Ok(config) => config,
        Err(e) => {
            let error_msg = format!("获取热词配置失败: {}", e);
            error!("{}", error_msg);
            return Err(error_msg);
        }
    };
    

    // 解码音频数据
    let audio_data = match BASE64.decode(&audio_base64) {
        Ok(data) => data,
        Err(e) => {
            let error_msg = format!("音频数据解码失败: {}", e);
            error!("{}", error_msg);
            return Err(error_msg);
        }
    };
    
    debug!("音频数据大小: {} bytes", audio_data.len());

    // 检测音频格式并处理
    let processed_audio = match process_audio_data_simple(audio_data) {
        Ok(data) => data,
        Err(e) => {
            error!("{}", e);
            return Err(e);
        }
    };
    
    // 创建客户端
    let client = SpeechClient::new(
        &speech_config.app_id,
        &speech_config.secret_id,
        &speech_config.secret_key,
        &speech_config.region,
    );

    // 检查当前引擎是否支持热词功能
    let engine_supports_hotword = is_hotword_supported(&recognition_config.engine_type);
    
    // 准备热词列表（仅在引擎支持时使用）
    let hotword_list: Vec<String> = if engine_supports_hotword && !hotword_config.hotwords.is_empty() {
        hotword_config.hotwords
            .iter()
            .map(|item| format!("{}|{}", item.word, item.weight))
            .collect()
    } else {
        Vec::new()
    };

    // 日志信息
    if !engine_supports_hotword && !hotword_config.hotwords.is_empty() {
        warn!("引擎 '{}' 不支持热词功能，已跳过 {} 个热词设置", 
              recognition_config.engine_type, hotword_config.hotwords.len());
    } else if engine_supports_hotword && !hotword_list.is_empty() {
        debug!("引擎 '{}' 支持热词功能，使用 {} 个热词", 
               recognition_config.engine_type, hotword_list.len());
    }

    // 配置识别参数
    let config = FlashRecognitionConfig {
        engine_type: recognition_config.engine_type,
        voice_format: recognition_config.voice_format,
        sample_rate: recognition_config.sample_rate.parse().unwrap_or(16000),
        speaker_diarization: if recognition_config.speaker_diarization { 1 } else { 0 },
        filter_dirty: if recognition_config.filter_dirty { 1 } else { 0 },
        filter_modal: if recognition_config.filter_modal { 1 } else { 0 },
        filter_punc: if recognition_config.filter_punc { 2 } else { 0 },
        convert_num_mode: if recognition_config.convert_num_mode { 0 } else { 1 },
        word_info: if recognition_config.word_info { 1 } else { 0 },
        first_channel_only: if recognition_config.first_channel_only { 1 } else { 0 },
        hotword_list: if hotword_list.is_empty() { None } else { Some(hotword_list.join(";")) },
    };

    debug!("识别配置: {:?}", config);
    if !hotword_list.is_empty() {
        debug!("热词配置: {:?}", hotword_list);
    }

    // 执行识别
    info!("正在调用腾讯云语音识别API");
    match client.flash_recognize(Bytes::from(processed_audio), config).await {
        Ok(result) => {
            info!("语音识别API调用成功");
            debug!("识别结果: {:?}", result);
            
            // 检查API响应状态
            if result.code != 0 {
                error!("腾讯云API返回错误: code={}, message={}", result.code, result.message);
                return Err(format!("语音识别失败: {} (错误码: {})", result.message, result.code));
            }
            
            // 检查是否有识别结果
            if result.flash_result.is_empty() {
                warn!("API调用成功但没有返回识别结果");
                return Ok("没有识别到语音内容，请确保音频清晰且包含语音".to_string());
            }
            
            // 提取识别结果
            let text = result.flash_result
                .get(0)
                .map(|r| r.text.clone())
                .unwrap_or_else(|| "没有识别到语音内容".to_string());
            
            if text.trim().is_empty() {
                warn!("识别结果为空");
                Ok("没有识别到语音内容，请重试".to_string())
            } else {
                info!("识别成功: {}", text);
                Ok(text)
            }
        }
        Err(e) => {
            error!("语音识别失败: {}", e);
            Err(format!("语音识别失败: {}", e))
        }
    }
}

fn process_audio_data_simple(audio_data: Vec<u8>) -> Result<Bytes, String> {
    debug!("开始处理音频数据");
    
    // 检查音频数据大小
    if audio_data.len() < 1024 {
        let error_msg = "音频数据太小，请录制更长的音频";
        error!("{}", error_msg);
        return Err(error_msg.to_string());
    }
    
    if audio_data.len() > 60 * 1024 * 1024 {
        let error_msg = "音频文件太大，请录制较短的音频";
        error!("{}", error_msg);
        return Err(error_msg.to_string());
    }
    
    // 检查是否是 WAV 格式
    if is_wav_format(&audio_data) {
        debug!("检测到 WAV 格式");
        return Ok(Bytes::from(audio_data));
    }
    
    // 如果不是 WAV 格式，尝试转换
    debug!("非 WAV 格式，尝试处理");
    
    // 检查是否是 WebM 格式
    if is_webm_format(&audio_data) {
        debug!("检测到 WebM 格式");
        warn!("WebM 格式可能不被腾讯云ASR完全支持，建议使用WAV格式");
        // WebM 格式的处理比较复杂，这里先返回原始数据
        // 实际项目中可能需要使用 ffmpeg 或其他工具进行转换
        return Ok(Bytes::from(audio_data));
    }
    
    // 对于其他格式，先尝试直接使用
    debug!("未知格式，直接使用原始数据");
    warn!("音频格式未知，建议使用WAV格式以获得最佳兼容性");
    Ok(Bytes::from(audio_data))
}

fn is_wav_format(data: &[u8]) -> bool {
    data.len() >= 12 && 
    &data[0..4] == b"RIFF" && 
    &data[8..12] == b"WAVE"
}

fn is_webm_format(data: &[u8]) -> bool {
    // WebM 文件通常以 EBML 头开始
    data.len() >= 4 && 
    data[0] == 0x1A && 
    data[1] == 0x45 && 
    data[2] == 0xDF && 
    data[3] == 0xA3
}