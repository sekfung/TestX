use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use std::collections::BTreeMap;
use url::form_urlencoded;

use crate::error::{Error, Result};

type HmacSha1 = Hmac<Sha1>;

pub(crate) fn generate_signature(
    method: &str,
    params: &mut BTreeMap<String, String>,
    access_key_secret: &str,
) -> Result<String> {
    // 1. Create canonicalized query string
    let canonical_query = params
        .iter()
        .map(|(k, v)| {
            format!(
                "{}={}",
                percent_encode(k),
                percent_encode(v)
            )
        })
        .collect::<Vec<String>>()
        .join("&");

    // 2. Create string to sign
    let string_to_sign = format!(
        "{}&%2F&{}",
        method,
        percent_encode(&canonical_query)
    );

    // 3. Calculate HMAC-SHA1
    let key = format!("{}&", access_key_secret);
    let mut mac = HmacSha1::new_from_slice(key.as_bytes())
        .map_err(|e| Error::SignatureError(e.to_string()))?;
    mac.update(string_to_sign.as_bytes());
    let result = mac.finalize();
    let signature = BASE64.encode(result.into_bytes());

    Ok(signature)
}

fn percent_encode(s: &str) -> String {
    form_urlencoded::byte_serialize(s.as_bytes())
        .collect::<String>()
        .replace("+", "%20")
        .replace("*", "%2A")
        .replace("%7E", "~")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_generation() {
        let mut params = BTreeMap::new();
        params.insert("AccessKeyId".to_string(), "testid".to_string());
        params.insert("Action".to_string(), "Pub".to_string());
        params.insert("Format".to_string(), "JSON".to_string());
        params.insert("RegionId".to_string(), "cn-shanghai".to_string());
        params.insert("Version".to_string(), "2018-01-20".to_string());
        params.insert("SignatureMethod".to_string(), "HMAC-SHA1".to_string());
        params.insert("SignatureVersion".to_string(), "1.0".to_string());
        params.insert("SignatureNonce".to_string(), "45e25e9b-0a6f-4070-8c85-2956eda1b466".to_string());
        params.insert("Timestamp".to_string(), "2017-07-19T12:00:00Z".to_string());

        let signature = generate_signature("GET", &mut params, "testsecret");
        assert!(signature.is_ok());
    }
} 