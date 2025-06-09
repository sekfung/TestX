use bytes::Bytes;
use std::env;
use std::fs;
use tencentcloud_speech_rust_sdk::{FlashRecognitionConfig, SpeechClient};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 从环境变量获取配置
    let app_id = env::var("TENCENT_APP_ID").expect("TENCENT_APP_ID not set");
    let secret_id = env::var("TENCENT_SECRET_ID").expect("TENCENT_SECRET_ID not set");
    let secret_key = env::var("TENCENT_SECRET_KEY").expect("TENCENT_SECRET_KEY not set");

    // 创建客户端
    let client = SpeechClient::new(app_id, secret_id, secret_key);

    // 读取音频文件
    let audio_path = env::args()
        .nth(1)
        .expect("Please provide the path to an audio file");
    let audio_data = Bytes::from(fs::read(audio_path)?);

    // 配置识别参数
    let config = FlashRecognitionConfig {
        engine_type: "16k_zh".to_string(),
        voice_format: "wav".to_string(),
        word_info: 1, // 启用词级别时间戳
        ..Default::default()
    };

    // 发送识别请求
    println!("Sending recognition request...");
    match client.flash_recognize(audio_data, config).await {
        Ok(response) => {
            println!("Recognition successful!");
            println!("Request ID: {}", response.request_id);
            println!("Audio Duration: {}ms", response.audio_duration);
            
            for result in response.flash_result {
                println!("\nChannel {}: {}", result.channel_id, result.text);
                
                for sentence in result.sentence_list {
                    println!("\nSentence: {}", sentence.text);
                    println!("Time: {}ms - {}ms", sentence.start_time, sentence.end_time);
                    println!("Speaker: {}", sentence.speaker_id);
                    
                    for word in sentence.word_list {
                        println!("Word: {}, Time: {}ms - {}ms", 
                            word.word, word.start_time, word.end_time);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Recognition failed: {}", e);
        }
    }

    Ok(())
} 