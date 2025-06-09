use std::collections::BTreeMap;
use chrono::Utc;
use uuid::Uuid;

#[derive(Default, Debug, Clone)]
pub struct RequestBuilder {
    params: BTreeMap<String, String>,
    format: String,
    version: String,
    signature_method: String,
    signature_version: String,
}

impl RequestBuilder {
    pub fn new() -> Self {
        let mut builder = Self {
            params: BTreeMap::new(),
            format: "JSON".to_string(),
            version: "2018-01-20".to_string(),
            signature_method: "HMAC-SHA1".to_string(),
            signature_version: "1.0".to_string(),
        };
        builder.with_timestamp(Utc::now());
        builder.with_signature_nonce(Uuid::new_v4().to_string());
        builder
    }

    pub fn with_format(&mut self, format: impl Into<String>) -> &mut Self {
        self.format = format.into();
        self
    }

    pub fn with_version(&mut self, version: impl Into<String>) -> &mut Self {
        self.version = version.into();
        self
    }

    pub fn with_param(&mut self, key: impl Into<String>, value: impl Into<String>) -> &mut Self {
        self.params.insert(key.into(), value.into());
        self
    }

    pub fn with_timestamp(&mut self, timestamp: chrono::DateTime<Utc>) -> &mut Self {
        self.params.insert(
            "Timestamp".to_string(),
            timestamp.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        );
        self
    }

    pub fn with_signature_method(&mut self, method: impl Into<String>) -> &mut Self {
        self.signature_method = method.into();
        self
    }

    pub fn with_signature_version(&mut self, version: impl Into<String>) -> &mut Self {
        self.signature_version = version.into();
        self
    }

    pub fn with_signature_nonce(&mut self, nonce: impl Into<String>) -> &mut Self {
        self.params.insert("SignatureNonce".to_string(), nonce.into());
        self
    }

    pub fn build_params(&self) -> BTreeMap<String, String> {
        let mut params = self.params.clone();
        params.insert("Format".to_string(), self.format.clone());
        params.insert("Version".to_string(), self.version.clone());
        params.insert("SignatureMethod".to_string(), self.signature_method.clone());
        params.insert("SignatureVersion".to_string(), self.signature_version.clone());
        params
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_builder() {
        let mut builder = RequestBuilder::new();
        builder
            .with_format("XML")
            .with_version("2018-01-20")
            .with_param("Action", "Pub")
            .with_param("ProductKey", "test_product");

        let params = builder.build_params();
        assert_eq!(params.get("Format").unwrap(), "XML");
        assert_eq!(params.get("Version").unwrap(), "2018-01-20");
        assert_eq!(params.get("Action").unwrap(), "Pub");
        assert_eq!(params.get("ProductKey").unwrap(), "test_product");
        assert!(params.contains_key("Timestamp"));
        assert!(params.contains_key("SignatureNonce"));
    }
} 