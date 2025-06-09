use std::env;
use crate::error::Result;

#[derive(Clone, Debug)]
pub struct IoT {
    access_key_id: String,
    access_key_secret: String,
    region_id: String,
    endpoint: String,
}

impl IoT {
    pub fn new(
        access_key_id: impl Into<String>,
        access_key_secret: impl Into<String>,
        region_id: impl Into<String>,
    ) -> Self {
        let region = region_id.into();
        Self {
            access_key_id: access_key_id.into(),
            access_key_secret: access_key_secret.into(),
            region_id: region.clone(),
            endpoint: format!("iot.{}.aliyuncs.com", region),
        }
    }

    pub fn from_env() -> Result<Self> {
        Ok(Self::new(
            env::var("ALIYUN_ACCESS_KEY_ID")?,
            env::var("ALIYUN_ACCESS_KEY_SECRET")?,
            env::var("ALIYUN_REGION_ID")?,
        ))
    }

    pub fn with_endpoint(mut self, endpoint: impl Into<String>) -> Self {
        self.endpoint = endpoint.into();
        self
    }

    pub fn access_key_id(&self) -> &str {
        &self.access_key_id
    }

    pub fn access_key_secret(&self) -> &str {
        &self.access_key_secret
    }

    pub fn region_id(&self) -> &str {
        &self.region_id
    }

    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_iot() {
        let iot = IoT::new("key_id", "key_secret", "cn-shanghai");
        assert_eq!(iot.access_key_id(), "key_id");
        assert_eq!(iot.access_key_secret(), "key_secret");
        assert_eq!(iot.region_id(), "cn-shanghai");
        assert_eq!(iot.endpoint(), "iot.cn-shanghai.aliyuncs.com");
    }

    #[test]
    fn test_with_endpoint() {
        let iot = IoT::new("key_id", "key_secret", "cn-shanghai")
            .with_endpoint("custom.endpoint.com");
        assert_eq!(iot.endpoint(), "custom.endpoint.com");
    }
} 