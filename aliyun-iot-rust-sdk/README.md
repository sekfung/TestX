# Aliyun IoT Rust SDK

A Rust SDK for Aliyun (Alibaba Cloud) IoT Platform, providing a simple and type-safe way to interact with Aliyun IoT services.

## Features

- Asynchronous API support
- Type-safe request and response handling
- Comprehensive error handling
- Support for IoT Platform's Pub API
- Configurable via environment variables
- Signature generation for API authentication

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
aliyun-iot-rust-sdk = "0.1.0"
```

## Usage

```rust
use aliyun_iot_rust_sdk::{IoT, IoTClient, IoTApi, PubRequest};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create client
    let iot = IoT::from_env()?;
    let client = IoTClient::new(iot);

    // Create publish request
    let request = PubRequest::new(
        "your_product_key".to_string(),
        "/your_product_key/your_device_name/user/topic".to_string(),
        "Hello, IoT!".to_string(),
    ).with_qos(1);

    // Send message
    let response = client.pub_message(request).await?;
    println!("Message published successfully: {:?}", response);

    Ok(())
}
```

## Configuration

The SDK can be configured using environment variables:

```bash
# Required
export ALIYUN_ACCESS_KEY_ID="your_access_key_id"
export ALIYUN_ACCESS_KEY_SECRET="your_access_key_secret"

# Optional
export ALIYUN_REGION_ID="cn-shanghai"  # Defaults to cn-shanghai if not set
```

## Running Tests

### Unit Tests

To run unit tests:

```bash
cargo test --lib
```

### Integration Tests

Integration tests require valid Aliyun IoT credentials and product information. Set the following environment variables before running the tests:

```bash
# Required credentials
export ALIYUN_ACCESS_KEY_ID="your_access_key_id"
export ALIYUN_ACCESS_KEY_SECRET="your_access_key_secret"

# Required IoT product information
export ALIYUN_IOT_PRODUCT_KEY="your_product_key"

# Optional configuration
export ALIYUN_REGION_ID="cn-shanghai"  # Defaults to cn-shanghai if not set
```

Then run the integration tests:

```bash
# Run all tests
cargo test

# Run specific integration test with output
cargo test --test pub -- --nocapture
```

### Test Environment Setup

1. Log in to the [Aliyun Console](https://home.console.aliyun.com/)
2. Navigate to AccessKey Management to get your Access Key ID and Secret
3. Go to IoT Platform Console to get your Product Key
4. Set up the environment variables as shown above
5. Run the tests

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 