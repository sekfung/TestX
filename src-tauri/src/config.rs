use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, Manager};
use log::{info, warn};
use crate::database::{encrypt_config_data, decrypt_config_data, Database};
use crate::iot_message::DatabaseState;

// 配置结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechConfig {
    pub app_id: String,
    pub secret_id: String,
    pub secret_key: String,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoTConfig {
    pub platform: String,
    pub access_key_id: String,
    pub access_key_secret: String,
    pub region_id: String,
    pub instance_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionConfig {
    pub engine_type: String,
    pub voice_format: String,
    pub sample_rate: String,
    pub speaker_diarization: bool,
    pub filter_dirty: bool,
    pub filter_modal: bool,
    pub filter_punc: bool,
    pub convert_num_mode: bool,
    pub word_info: bool,
    pub first_channel_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotwordItem {
    pub word: String,
    pub weight: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotwordConfig {
    pub hotwords: Vec<HotwordItem>,
}

impl Default for RecognitionConfig {
    fn default() -> Self {
        Self {
            engine_type: "16k_zh".to_string(),
            voice_format: "wav".to_string(),
            sample_rate: "16000".to_string(),
            speaker_diarization: false,
            filter_dirty: false,
            filter_modal: false,
            filter_punc: true,
            convert_num_mode: true,
            word_info: true,
            first_channel_only: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub speech: Option<SpeechConfig>,
    pub iot: Option<IoTConfig>,
    pub recognition: Option<RecognitionConfig>,
    pub hotword: Option<HotwordConfig>,
}

// 获取旧配置文件路径（用于迁移）
fn get_legacy_config_path() -> Result<PathBuf, String> {
    let mut config_dir = dirs::config_dir()
        .ok_or("无法获取配置目录")?;
    config_dir.push("testx");
    config_dir.push("config.json");
    Ok(config_dir)
}

// 从旧文件迁移配置到数据库
async fn migrate_legacy_config_if_needed(db: &Database) -> Result<(), String> {
    let legacy_path = get_legacy_config_path()?;
    
    if !legacy_path.exists() {
        return Ok(()); // 没有旧配置文件，无需迁移
    }
    
    info!("发现旧配置文件，开始迁移到数据库");
    
    // 读取旧配置文件
    let legacy_config = load_legacy_config().await?;
    
    // 迁移各个配置到数据库
    if let Some(speech) = legacy_config.speech {
        let json_data = serde_json::to_string(&speech)
            .map_err(|e| format!("序列化语音配置失败: {}", e))?;
        let encrypted_data = encrypt_config_data(&json_data)?;
        db.save_config("speech", &encrypted_data).await
            .map_err(|e| format!("保存语音配置到数据库失败: {}", e))?;
        info!("语音配置已迁移到数据库");
    }
    
    if let Some(iot) = legacy_config.iot {
        let json_data = serde_json::to_string(&iot)
            .map_err(|e| format!("序列化IoT配置失败: {}", e))?;
        let encrypted_data = encrypt_config_data(&json_data)?;
        db.save_config("iot", &encrypted_data).await
            .map_err(|e| format!("保存IoT配置到数据库失败: {}", e))?;
        info!("IoT配置已迁移到数据库");
    }
    
    if let Some(recognition) = legacy_config.recognition {
        let json_data = serde_json::to_string(&recognition)
            .map_err(|e| format!("序列化识别配置失败: {}", e))?;
        let encrypted_data = encrypt_config_data(&json_data)?;
        db.save_config("recognition", &encrypted_data).await
            .map_err(|e| format!("保存识别配置到数据库失败: {}", e))?;
        info!("识别配置已迁移到数据库");
    }
    
    if let Some(hotword) = legacy_config.hotword {
        let json_data = serde_json::to_string(&hotword)
            .map_err(|e| format!("序列化热词配置失败: {}", e))?;
        let encrypted_data = encrypt_config_data(&json_data)?;
        db.save_config("hotword", &encrypted_data).await
            .map_err(|e| format!("保存热词配置到数据库失败: {}", e))?;
        info!("热词配置已迁移到数据库");
    }
    
    // 备份旧配置文件
    let backup_path = legacy_path.with_extension("json.backup");
    if let Err(e) = fs::rename(&legacy_path, &backup_path) {
        warn!("备份旧配置文件失败: {}", e);
    } else {
        info!("旧配置文件已备份到: {:?}", backup_path);
    }
    
    info!("配置迁移完成");
    Ok(())
}

// 从数据库加载配置
async fn load_config_from_db(db: &Database, config_type: &str) -> Result<Option<String>, String> {
    match db.load_config(config_type).await {
        Ok(Some(encrypted_data)) => {
            let json_data = decrypt_config_data(&encrypted_data)?;
            Ok(Some(json_data))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("从数据库加载配置失败: {}", e))
    }
}

// 保存配置到数据库
async fn save_config_to_db(db: &Database, config_type: &str, config: &impl Serialize) -> Result<(), String> {
    let json_data = serde_json::to_string(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    let encrypted_data = encrypt_config_data(&json_data)?;
    db.save_config(config_type, &encrypted_data).await
        .map_err(|e| format!("保存配置到数据库失败: {}", e))?;
    Ok(())
}

// Tauri 命令函数
#[command]
pub async fn save_speech_config(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
    config: SpeechConfig,
) -> Result<(), String> {
    info!("保存语音识别配置");
    
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        save_config_to_db(db, "speech", &config).await?;
    } else {
        return Err("数据库未初始化".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn save_iot_config(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
    config: IoTConfig,
) -> Result<(), String> {
    info!("保存IoT配置");
    
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        save_config_to_db(db, "iot", &config).await?;
    } else {
        return Err("数据库未初始化".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn save_recognition_config(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
    config: RecognitionConfig,
) -> Result<(), String> {
    info!("保存识别设置配置");
    
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        save_config_to_db(db, "recognition", &config).await?;
    } else {
        return Err("数据库未初始化".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn load_speech_config(
    app_handle: tauri::AppHandle,
) -> Result<Option<SpeechConfig>, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        // 首次运行时尝试迁移旧配置
        if let Err(e) = migrate_legacy_config_if_needed(db).await {
            warn!("迁移旧配置失败: {}", e);
        }
        
        if let Some(json_data) = load_config_from_db(db, "speech").await? {
            let config: SpeechConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化语音配置失败: {}", e))?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[command]
pub async fn load_iot_config(
    app_handle: tauri::AppHandle,
) -> Result<Option<IoTConfig>, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "iot").await? {
            let config: IoTConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化IoT配置失败: {}", e))?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[command]
pub async fn load_recognition_config(
    app_handle: tauri::AppHandle,
) -> Result<Option<RecognitionConfig>, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "recognition").await? {
            let config: RecognitionConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化识别配置失败: {}", e))?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

#[command]
pub async fn delete_config(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
    config_type: String,
) -> Result<(), String> {
    info!("删除配置: {}", config_type);
    
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        db.delete_config(&config_type).await
            .map_err(|e| format!("删除配置失败: {}", e))?;
    } else {
        return Err("数据库未初始化".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn save_hotword_config(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
    config: HotwordConfig,
) -> Result<(), String> {
    info!("保存热词配置");
    
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        save_config_to_db(db, "hotword", &config).await?;
    } else {
        return Err("数据库未初始化".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn load_hotword_config(
    app_handle: tauri::AppHandle,
) -> Result<Option<HotwordConfig>, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "hotword").await? {
            let config: HotwordConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化热词配置失败: {}", e))?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 内部函数（保持兼容性）
pub async fn get_speech_config(app_handle: &tauri::AppHandle) -> Result<SpeechConfig, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "speech").await? {
            let config: SpeechConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化语音配置失败: {}", e))?;
            Ok(config)
        } else {
            Err("语音识别配置未设置，请先在设置页面配置".to_string())
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

pub async fn get_recognition_config(app_handle: &tauri::AppHandle) -> Result<RecognitionConfig, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "recognition").await? {
            let config: RecognitionConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化识别配置失败: {}", e))?;
            Ok(config)
        } else {
            Ok(RecognitionConfig::default())
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

pub async fn get_hotword_config(app_handle: &tauri::AppHandle) -> Result<HotwordConfig, String> {
    let db_state = app_handle.state::<DatabaseState>();
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        if let Some(json_data) = load_config_from_db(db, "hotword").await? {
            let config: HotwordConfig = serde_json::from_str(&json_data)
                .map_err(|e| format!("反序列化热词配置失败: {}", e))?;
            Ok(config)
        } else {
            Ok(HotwordConfig { hotwords: vec![] })
        }
    } else {
        Err("数据库未初始化".to_string())
    }
}

// 旧配置文件相关函数（用于迁移）
use aes::Aes256;
use cbc::{Decryptor, Encryptor};
use cbc::cipher::{BlockDecryptMut, KeyIvInit};
use sha2::{Digest, Sha256};

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

fn get_legacy_encryption_key() -> [u8; 32] {
    let machine_id = get_legacy_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(b"testx_config_salt_2024");
    let result = hasher.finalize();
    result.into()
}

fn get_legacy_machine_id() -> String {
    format!("{}_{}", 
        std::env::var("USER").or_else(|_| std::env::var("USERNAME")).unwrap_or_default(),
        "testx_app"
    )
}

fn decrypt_legacy_data(encrypted_hex: &str) -> Result<String, String> {
    let encrypted_data = hex::decode(encrypted_hex)
        .map_err(|e| format!("十六进制解码失败: {}", e))?;
    
    if encrypted_data.len() < 16 {
        return Err("加密数据格式错误".to_string());
    }
    
    let (iv, encrypted) = encrypted_data.split_at(16);
    let key = get_legacy_encryption_key();
    
    let cipher = Aes256CbcDec::new(&key.into(), iv.try_into().unwrap());
    
    let mut buffer = encrypted.to_vec();
    let decrypted = cipher.decrypt_padded_mut::<cbc::cipher::block_padding::NoPadding>(&mut buffer)
        .map_err(|e| format!("解密失败: {}", e))?;
    
    let padding_len = *decrypted.last().unwrap_or(&0) as usize;
    if padding_len > 16 || padding_len == 0 {
        return Err("填充格式错误".to_string());
    }
    
    let data_len = decrypted.len() - padding_len;
    let data = &decrypted[..data_len];
    
    String::from_utf8(data.to_vec())
        .map_err(|e| format!("UTF-8解码失败: {}", e))
}

async fn load_legacy_config() -> Result<AppConfig, String> {
    let config_path = get_legacy_config_path()?;
    
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    
    let encrypted_data = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let json_data = decrypt_legacy_data(&encrypted_data)?;
    
    let config: AppConfig = serde_json::from_str(&json_data)
        .map_err(|e| format!("反序列化配置失败: {}", e))?;
    
    Ok(config)
}

#[command]
pub async fn check_config_status(
    _app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let db_guard = db_state.0.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        // 检查语音识别配置
        let speech_configured = match load_config_from_db(db, "speech").await {
            Ok(Some(_)) => true,
            _ => false,
        };
        
        // 检查IoT配置
        let iot_configured = match load_config_from_db(db, "iot").await {
            Ok(Some(_)) => true,
            _ => false,
        };
        
        Ok(serde_json::json!({
            "speech_configured": speech_configured,
            "iot_configured": iot_configured
        }))
    } else {
        Err("数据库未初始化".to_string())
    }
}