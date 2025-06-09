# Tencent Cloud Speech SDK for Rust

这是一个非官方的腾讯云语音识别 SDK Rust 实现。目前支持录音文件识别极速版接口。

## 功能特性

- 录音文件识别极速版
- 支持多种音频格式（wav、pcm、ogg-opus、speex、silk、mp3、m4a、aac、amr）
- 支持词级别时间戳
- 支持多声道音频
- 支持热词
- 支持标点过滤
- 支持数字转换

## 安装

将以下依赖添加到你的 `Cargo.toml`：

```toml
[dependencies]
tencentcloud-speech-rust-sdk = "0.1.0"
```

## 使用示例

```rust
use tencentcloud_speech_rust_sdk::{SpeechClient, FlashRecognitionConfig};
use bytes::Bytes;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建客户端
    let client = SpeechClient::new(
        "your_app_id",
        "your_secret_id",
        "your_secret_key",
    );

    // 读取音频文件
    let audio_data = Bytes::from(std::fs::read("audio.wav")?);

    // 配置识别参数
    let config = FlashRecognitionConfig {
        engine_type: "16k_zh".to_string(),
        voice_format: "wav".to_string(),
        word_info: 1, // 启用词级别时间戳
        ..Default::default()
    };

    // 发送识别请求
    match client.flash_recognize(audio_data, config).await {
        Ok(response) => {
            println!("识别结果: {:?}", response);
        }
        Err(e) => {
            eprintln!("识别失败: {}", e);
        }
    }

    Ok(())
}
```

## 环境变量配置

你可以通过环境变量来配置认证信息：

```bash
export TENCENT_APP_ID="your_app_id"
export TENCENT_SECRET_ID="your_secret_id"
export TENCENT_SECRET_KEY="your_secret_key"
```

## 运行示例程序

```bash
cargo run --example flash_recognize path/to/audio.wav
```

## API 文档

### SpeechClient

主要的客户端类，用于创建语音识别请求。

```rust
// 创建新的客户端实例
let client = SpeechClient::new(app_id, secret_id, secret_key);

// 发送录音文件识别请求
let result = client.flash_recognize(audio_data, config).await?;
```

### FlashRecognitionConfig

识别配置选项：

- `engine_type`: 引擎类型，如 "16k_zh"
- `voice_format`: 音频格式，如 "wav"
- `speaker_diarization`: 是否开启说话人分离
- `filter_dirty`: 是否过滤脏话
- `filter_modal`: 是否过滤语气词
- `filter_punc`: 是否过滤标点符号
- `convert_num_mode`: 数字转换模式
- `word_info`: 是否返回词级别时间戳
- `hotword_id`: 热词 ID
- `first_channel_only`: 是否只识别首个声道

## 错误处理

SDK 定义了以下错误类型：

- `RequestError`: HTTP 请求错误
- `UrlError`: URL 解析错误
- `HmacError`: 签名生成错误
- `ApiError`: API 返回错误，包含错误码和错误信息

## 许可证

MIT

## 参考文档

- [腾讯云录音文件识别极速版接口文档](https://cloud.tencent.com/document/product/1093/52097) 