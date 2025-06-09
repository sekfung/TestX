use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client as HttpClient;
use serde::de::DeserializeOwned;
use log::{info, debug};
use serde_json::Value;

use crate::{
    error::{Error, Result},
    iot::IoT,
    request::RequestBuilder,
    signature::generate_signature,
    types::{ApiResponse, ErrorResponse, PubRequest, PubResponse},
};

#[async_trait]
pub trait IoTApi {
    async fn pub_message(&self, request: PubRequest) -> Result<PubResponse>;
    async fn reset_thing(&self, product_key: Option<&str>, device_name: Option<&str>, iot_id: Option<&str>, iot_instance_id: Option<&str>) -> Result<Value>;
}

pub struct IoTClient {
    iot: IoT,
    http_client: HttpClient,
    use_https: bool,
}

impl IoTClient {
    pub fn new(iot: IoT) -> Self {
        Self {
            iot,
            http_client: HttpClient::new(),
            use_https: true,
        }
    }

    pub fn with_https(mut self, use_https: bool) -> Self {
        self.use_https = use_https;
        self
    }

    pub fn from_env() -> Result<Self> {
        Ok(Self::new(IoT::from_env()?))
    }

    async fn request<T: DeserializeOwned>(&self, action: &str, builder: &mut RequestBuilder) -> Result<T> {
        let mut params = builder.build_params();
        
        // Add common parameters
        params.insert("AccessKeyId".to_string(), self.iot.access_key_id().to_string());
        params.insert("Action".to_string(), action.to_string());
        params.insert("RegionId".to_string(), self.iot.region_id().to_string());

        // 记录请求参数的详细信息（签名前）
        let request_info = serde_json::json!({
            "action": action,
            "endpoint": self.iot.endpoint(),
            "region_id": self.iot.region_id(),
            "access_key_id": self.iot.access_key_id(),
            "parameters": params,
            "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
        });
        
        info!("🔄 阿里云IoT请求详情: {}", serde_json::to_string_pretty(&request_info).unwrap_or_default());

        // Generate signature
        let signature = generate_signature("GET", &mut params, self.iot.access_key_secret())?;
        params.insert("Signature".to_string(), signature);

        // Build URL
        let scheme = if self.use_https { "https" } else { "http" };
        let endpoint = format!("{}://{}", scheme, self.iot.endpoint());
        let url = reqwest::Url::parse_with_params(&endpoint, params.iter())?;

        debug!("🌐 阿里云IoT请求URL: {}", url);

        // 记录完整的请求信息（包含签名）
        let full_request_info = serde_json::json!({
            "method": "GET",
            "url": url.to_string(),
            "query_params": url.query_pairs().collect::<std::collections::HashMap<_, _>>(),
            "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
        });
        
        debug!("📤 阿里云IoT完整请求: {}", serde_json::to_string_pretty(&full_request_info).unwrap_or_default());

        // Send request
        let response = self.http_client.get(url).send().await?;
        let status = response.status();
        let text = response.text().await?;

        // 记录响应信息
        let response_info = serde_json::json!({
            "status_code": status.as_u16(),
            "status_text": status.canonical_reason().unwrap_or("Unknown"),
            "body": text,
            "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
        });

        info!("📥 阿里云IoT API响应: {}", serde_json::to_string_pretty(&response_info).unwrap_or_default());

        if !status.is_success() {
            let error: ErrorResponse = serde_json::from_str(&text)
                .map_err(|e| Error::Other(format!("Failed to parse error response: {}", e)))?;
            return Err(Error::ApiError {
                code: error.code,
                message: error.message,
            });
        }

        serde_json::from_str(&text)
            .map_err(|e| Error::Other(format!("Failed to parse response: {}", e)))
    }
}

#[async_trait]
impl IoTApi for IoTClient {
    async fn pub_message(&self, request: PubRequest) -> Result<PubResponse> {
        // 记录详细的消息发送请求信息
        let message_request_info = serde_json::json!({
            "action": "Pub",
            "product_key": request.product_key,
            "topic_full_name": request.topic_full_name,
            "message_content": request.message_content,
            "message_content_base64": BASE64.encode(&request.message_content),
            "qos": request.qos,
            "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
        });
        
        info!("📮 开始发送阿里云IoT消息: {}", serde_json::to_string_pretty(&message_request_info).unwrap_or_default());
        
        let mut builder = RequestBuilder::new();
        builder
            .with_param("ProductKey", request.product_key)
            .with_param("TopicFullName", request.topic_full_name)
            .with_param("MessageContent", BASE64.encode(request.message_content));

        if let Some(qos) = request.qos {
            builder.with_param("Qos", qos.to_string());
        }

        let response: ApiResponse<PubResponse> = self.request("Pub", &mut builder).await?;
        
        // 记录详细的响应信息
        let message_response_info = serde_json::json!({
            "success": response.data.success,
            "message_id": response.data.message_id,
            "request_id": response.data.request_id,
            "code": response.data.code,
            "message": response.data.message,
            "timestamp": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
        });
        
        info!("✅ 阿里云IoT消息发送完成: {}", serde_json::to_string_pretty(&message_response_info).unwrap_or_default());
        
        Ok(response.data)
    }

    async fn reset_thing(&self, product_key: Option<&str>, device_name: Option<&str>, iot_id: Option<&str>, iot_instance_id: Option<&str>) -> Result<Value> {
        let mut request = RequestBuilder::new();
        request.with_version("2018-01-20")
            .with_param("Action", "ResetThing");

        if let Some(pk) = product_key {
            request.with_param("ProductKey", pk);
        }
        if let Some(dn) = device_name {
            request.with_param("DeviceName", dn);
        }
        if let Some(id) = iot_id {
            request.with_param("IotId", id);
        }
        if let Some(instance_id) = iot_instance_id {
            request.with_param("IotInstanceId", instance_id);
        }

        let response: Value = self.request("ResetThing", &mut request).await?;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::{
        matchers::{method, query_param},
        Mock, MockServer, ResponseTemplate,
    };

    #[tokio::test]
    async fn test_pub_message() {
        // Start mock server
        let mock_server = MockServer::start().await;

        // Create mock response
        Mock::given(method("GET"))
            .and(query_param("Action", "Pub"))
            .respond_with(ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({
                    "RequestId": "1234",
                    "Success": true,
                    "MessageId": "1929055222791097856",
                    "Code": "200",
                    "Message": "Success"
                })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let iot = IoT::new(
            "test_key",
            "test_secret",
            "cn-shanghai",
        ).with_endpoint(mock_server.uri().replace("http://", ""));

        let client = IoTClient::new(iot).with_https(false);

        let request = PubRequest::new(
            "product_key".to_string(),
            "/topic".to_string(),
            "test message".to_string(),
        );

        let response = client.pub_message(request).await;
        assert!(response.is_ok(), "Response error: {:?}", response);
        
        let response = response.unwrap();
        assert_eq!(response.code, Some("200".to_string()));
        assert_eq!(response.message, Some("Success".to_string()));
        assert!(response.success);
        assert_eq!(response.message_id, Some(1929055222791097856));
    }
}