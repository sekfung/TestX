use aliyun_iot_rust_sdk::{IoT, IoTClient, IoTApi, PubRequest};
use std::env;

#[tokio::test]
async fn test_pub_message() -> Result<(), Box<dyn std::error::Error>> {
    // Create client from environment variables
    let iot = IoT::new(
        env::var("ALIYUN_ACCESS_KEY_ID")?,
        env::var("ALIYUN_ACCESS_KEY_SECRET")?,
        env::var("ALIYUN_REGION_ID").unwrap_or_else(|_| "cn-shanghai".to_string()),
    );
    let client = IoTClient::new(iot);

    // Create publish request with real product and topic
    let request = PubRequest::new(
        env::var("ALIYUN_IOT_PRODUCT_KEY")?,
        format!("/{}/HWJ_TEST/user/service/voiceBroadcast", 
            env::var("ALIYUN_IOT_PRODUCT_KEY")?),
        "Hello, IoT!".to_string(),
    ).with_qos(1);

    // Send message
    let response = client.pub_message(request).await.unwrap();
    println!("Message published successfully: {:?}", response);
    assert!(response.success);
    assert!(response.message_id.is_some());
    assert!(response.message_id.unwrap() > 0);

    Ok(())
} 