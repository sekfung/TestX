#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Failed to generate signature: {0}")]
    SignatureError(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("API error: {code} - {message}")]
    ApiError {
        code: String,
        message: String,
    },

    #[error("URL parsing error: {0}")]
    UrlError(#[from] url::ParseError),

    #[error("Environment variable error: {0}")]
    EnvError(#[from] std::env::VarError),

    #[error("Other error: {0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>; 