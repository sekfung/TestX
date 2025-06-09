pub mod client;
pub mod error;
pub mod iot;
pub mod request;
pub mod signature;
pub mod types;

pub use client::{IoTApi, IoTClient};
pub use error::{Error, Result};
pub use iot::IoT;
pub use request::RequestBuilder;
pub use types::*;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_iot_creation() {
        let iot = IoT::new(
            "your_access_key_id",
            "your_access_key_secret",
            "cn-shanghai",
        );
        assert_eq!(iot.access_key_id(), "your_access_key_id");
        assert_eq!(iot.access_key_secret(), "your_access_key_secret");
        assert_eq!(iot.region_id(), "cn-shanghai");
    }
}
