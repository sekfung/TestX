use tauri::{AppHandle, State, command};
use crate::iot_message::DatabaseState;
use crate::audio_file_manager::AudioFileManager;
use crate::logger::Logger;

/// 获取测试记录的音频数据
/// 返回base64编码的音频数据，用于前端播放
#[command]
pub async fn get_test_audio_data(
    test_id: String,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<Option<String>, String> {
    Logger::info(&app_handle, &format!("获取测试音频数据: {}", test_id), "AudioAPI");
    
    // 从数据库获取测试记录
    let test = database.with_db(|db| {
        let test_id = test_id.clone();
        let fut = async move {
            db.get_accuracy_test_by_id(&test_id).await
                .map_err(|e| format!("获取测试记录失败: {}", e))
        };
        Box::pin(fut)
    }).await?;
    
    if let Some(test) = test {
        // 如果有音频文件路径，从文件读取
        if let Some(ref audio_file_path) = test.audio_file_path {
            let audio_file_manager = AudioFileManager::new(&app_handle)
                .map_err(|e| format!("初始化音频文件管理器失败: {}", e))?;
            
            match audio_file_manager.read_audio_data(&audio_file_path, &app_handle) {
                Ok(audio_base64) => {
                    Logger::debug(&app_handle, &format!("成功读取音频文件: {}", audio_file_path), "AudioAPI");
                    Ok(Some(audio_base64))
                }
                Err(e) => {
                    Logger::warn(&app_handle, &format!("读取音频文件失败: {}, 错误: {}", audio_file_path, e), "AudioAPI");
                    // 如果文件读取失败，检查是否还有数据库中的audio_data作为备用
                    if let Some(audio_data) = test.audio_data {
                        Logger::info(&app_handle, "使用数据库中的备用音频数据", "AudioAPI");
                        Ok(Some(audio_data))
                    } else {
                        Ok(None)
                    }
                }
            }
        } else if let Some(audio_data) = test.audio_data {
            // 如果没有文件路径但有数据库中的音频数据（向后兼容）
            Logger::info(&app_handle, "使用数据库中的音频数据（向后兼容）", "AudioAPI");
            Ok(Some(audio_data))
        } else {
            Logger::info(&app_handle, &format!("测试记录 {} 没有音频数据", test_id), "AudioAPI");
            Ok(None)
        }
    } else {
        Err(format!("测试记录不存在: {}", test_id))
    }
}

/// 删除测试记录的音频文件
#[command]
pub async fn delete_test_audio_file(
    test_id: String,
    app_handle: AppHandle,
    database: State<'_, DatabaseState>,
) -> Result<(), String> {
    Logger::info(&app_handle, &format!("删除测试音频文件: {}", test_id), "AudioAPI");
    
    // 从数据库获取测试记录
    let test = database.with_db(|db| {
        let test_id = test_id.clone();
        let fut = async move {
            db.get_accuracy_test_by_id(&test_id).await
                .map_err(|e| format!("获取测试记录失败: {}", e))
        };
        Box::pin(fut)
    }).await?;
    
    if let Some(test) = test {
        if let Some(ref audio_file_path) = test.audio_file_path {
            let audio_file_manager = AudioFileManager::new(&app_handle)
                .map_err(|e| format!("初始化音频文件管理器失败: {}", e))?;
            
            audio_file_manager.delete_audio_file(&audio_file_path, &app_handle)
                .map_err(|e| format!("删除音频文件失败: {}", e))?;
            
            Logger::info(&app_handle, &format!("成功删除音频文件: {}", audio_file_path), "AudioAPI");
        } else {
            Logger::info(&app_handle, &format!("测试记录 {} 没有关联的音频文件", test_id), "AudioAPI");
        }
    } else {
        return Err(format!("测试记录不存在: {}", test_id));
    }
    
    Ok(())
}

/// 清理旧的音频文件
#[command]
pub async fn cleanup_old_audio_files(
    app_handle: AppHandle,
) -> Result<(), String> {
    Logger::info(&app_handle, "开始清理旧音频文件", "AudioAPI");
    
    let audio_file_manager = AudioFileManager::new(&app_handle)
        .map_err(|e| format!("初始化音频文件管理器失败: {}", e))?;
    
    audio_file_manager.cleanup_old_files(&app_handle)
        .map_err(|e| format!("清理旧音频文件失败: {}", e))?;
    
    Logger::info(&app_handle, "旧音频文件清理完成", "AudioAPI");
    Ok(())
}