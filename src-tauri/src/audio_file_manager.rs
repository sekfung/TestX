use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};
use tauri::{AppHandle, Manager};
use crate::logger::Logger;

/// 音频文件管理器
pub struct AudioFileManager {
    audio_dir: PathBuf,
}

impl AudioFileManager {
    /// 创建新的音频文件管理器
    pub fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
        
        let audio_dir = app_data_dir.join("audio_recordings");
        
        // 确保音频目录存在
        if !audio_dir.exists() {
            fs::create_dir_all(&audio_dir)
                .map_err(|e| format!("创建音频目录失败: {}", e))?;
            Logger::info(app_handle, &format!("创建音频存储目录: {:?}", audio_dir), "AudioFileManager");
        }
        
        Ok(Self { audio_dir })
    }
    
    /// 保存音频数据到本地文件
    /// 返回相对于音频目录的文件路径
    pub fn save_audio_data(&self, test_id: &str, audio_base64: &str, app_handle: &AppHandle) -> Result<String, String> {
        // 解码base64数据
        let audio_data = general_purpose::STANDARD.decode(audio_base64)
            .map_err(|e| format!("解码音频数据失败: {}", e))?;
        
        // 生成文件名：测试ID_时间戳.wav
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let filename = format!("{}_{}.wav", test_id, timestamp);
        let file_path = self.audio_dir.join(&filename);
        
        // 获取数据大小用于日志
        let data_size = audio_data.len();
        
        // 保存文件
        fs::write(&file_path, audio_data)
            .map_err(|e| format!("保存音频文件失败: {}", e))?;
        
        Logger::info(app_handle, &format!("音频文件已保存: {:?}, 大小: {} bytes", file_path, data_size), "AudioFileManager");
        
        // 返回相对路径
        Ok(filename)
    }
    
    /// 读取音频文件数据
    /// 返回base64编码的音频数据
    pub fn read_audio_data(&self, filename: &str, app_handle: &AppHandle) -> Result<String, String> {
        let file_path = self.audio_dir.join(filename);
        
        if !file_path.exists() {
            return Err(format!("音频文件不存在: {:?}", file_path));
        }
        
        // 读取文件数据
        let audio_data = fs::read(&file_path)
            .map_err(|e| format!("读取音频文件失败: {}", e))?;
        
        // 编码为base64
        let audio_base64 = general_purpose::STANDARD.encode(&audio_data);
        
        Logger::debug(app_handle, &format!("读取音频文件: {:?}, 大小: {} bytes", file_path, audio_data.len()), "AudioFileManager");
        
        Ok(audio_base64)
    }
    
    /// 删除音频文件
    pub fn delete_audio_file(&self, filename: &str, app_handle: &AppHandle) -> Result<(), String> {
        let file_path = self.audio_dir.join(filename);
        
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("删除音频文件失败: {}", e))?;
            Logger::info(app_handle, &format!("音频文件已删除: {:?}", file_path), "AudioFileManager");
        }
        
        Ok(())
    }
    
    /// 获取音频文件的完整路径
    pub fn get_audio_file_path(&self, filename: &str) -> PathBuf {
        self.audio_dir.join(filename)
    }
    
    /// 清理旧的音频文件（保留最近30天的文件）
    pub fn cleanup_old_files(&self, app_handle: &AppHandle) -> Result<(), String> {
        let thirty_days_ago = Utc::now() - chrono::Duration::days(30);
        
        if let Ok(entries) = fs::read_dir(&self.audio_dir) {
            let mut deleted_count = 0;
            
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(created) = metadata.created() {
                            let created_time = chrono::DateTime::<Utc>::from(created);
                            if created_time < thirty_days_ago {
                                if let Err(e) = fs::remove_file(entry.path()) {
                                    Logger::warn(app_handle, &format!("删除旧音频文件失败: {:?}, 错误: {}", entry.path(), e), "AudioFileManager");
                                } else {
                                    deleted_count += 1;
                                }
                            }
                        }
                    }
                }
            }
            
            if deleted_count > 0 {
                Logger::info(app_handle, &format!("清理了 {} 个旧音频文件", deleted_count), "AudioFileManager");
            }
        }
        
        Ok(())
    }
}