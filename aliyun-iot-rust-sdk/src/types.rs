use serde::{Deserialize, Serialize, Deserializer};

fn deserialize_message_id<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum MessageIdValue {
        Number(i64),
        String(String),
    }
    
    let value = Option::<MessageIdValue>::deserialize(deserializer)?;
    match value {
        Some(MessageIdValue::Number(n)) => Ok(Some(n)),
        Some(MessageIdValue::String(s)) => {
            s.parse::<i64>()
                .map(Some)
                .map_err(|_| Error::custom(format!("Invalid MessageId string: {}", s)))
        }
        None => Ok(None),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubResponse {
    #[serde(rename = "RequestId")]
    pub request_id: String,
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "MessageId")]
    #[serde(default, deserialize_with = "deserialize_message_id")]
    pub message_id: Option<i64>,
    #[serde(rename = "Code")]
    #[serde(default)]
    pub code: Option<String>,
    #[serde(rename = "Message")]
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PubRequest {
    pub product_key: String,
    pub topic_full_name: String,
    pub message_content: String,
    pub qos: Option<i32>,
}

impl PubRequest {
    pub fn new(product_key: String, topic_full_name: String, message_content: String) -> Self {
        Self {
            product_key,
            topic_full_name,
            message_content,
            qos: Some(0),
        }
    }

    pub fn with_qos(mut self, qos: i32) -> Self {
        self.qos = Some(qos);
        self
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    #[serde(flatten)]
    pub data: T,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    #[serde(rename = "RequestId")]
    pub request_id: String,
    #[serde(rename = "Code")]
    pub code: String,
    #[serde(rename = "Message")]
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_pub_request() {
        let request = PubRequest::new(
            "product_key".to_string(),
            "/topic".to_string(),
            "message".to_string(),
        ).with_qos(1);

        assert_eq!(request.qos, Some(1));
    }

    #[test]
    fn test_pub_response_deserialize() {
        let json = json!({
            "RequestId": "123",
            "Success": true,
            "MessageId": 1929055222791097856i64
        });

        let response: PubResponse = serde_json::from_value(json).unwrap();
        assert_eq!(response.request_id, "123");
        assert!(response.success);
        assert_eq!(response.message_id, Some(1929055222791097856i64));
    }
} 