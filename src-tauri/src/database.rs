use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use std::str::FromStr;
use aes::Aes256;
use cbc::{Decryptor, Encryptor};
use cbc::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use sha2::{Digest, Sha256};
use rand::Rng;

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageTest {
    pub id: String,
    pub topic: String,
    pub qos_level: i32,
    pub payload: String,
    pub status: String, // pending, sent, failed
    pub sent_at: Option<DateTime<Utc>>,
    pub response: Option<String>,
    pub created_at: DateTime<Utc>,
    pub product_key: Option<String>,
    pub device_name: Option<String>,
    pub mode: String, // form, code
    pub python_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccuracyTest {
    pub id: String,
    pub expected_text: String,
    pub recognized_text: Option<String>,
    pub similarity: Option<f64>,
    pub result: String, // pending, passed, failed
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub audio_file_path: Option<String>,
    pub python_code: Option<String>,
    pub mode: String, // form, code
    pub error_message: Option<String>,
    pub notes: Option<String>,
    pub audio_data: Option<String>, // Base64编码的音频数据
    pub audio_duration: Option<i64>, // 音频时长（毫秒）
    pub test_mode: String, // manual, loop, timed
    pub loop_count: Option<i32>, // 循环次数（循环模式使用）
    pub scheduled_time: Option<String>, // 定时录音时间（定时模式使用）
    pub current_loop: i32, // 当前循环次数
    pub auto_executed: bool, // 是否自动执行代码
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigRecord {
    pub id: i64,
    pub config_type: String,
    pub config_data: String, // 加密的JSON数据
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub id: i64,
    pub name: String,
    pub value: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct Database {
    connection: sqlx::SqlitePool,
}

impl Database {
    pub async fn new(db_path: PathBuf) -> Result<Self, sqlx::Error> {
        // 确保数据库文件的父目录存在
        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    eprintln!("❌ 创建数据库目录失败: {:?}, 错误: {}", parent, e);
                    sqlx::Error::Io(e)
                })?;
            }
            
            // 检查目录权限
            let metadata = std::fs::metadata(parent).map_err(|e| {
                eprintln!("❌ 无法读取目录元数据: {:?}, 错误: {}", parent, e);
                sqlx::Error::Io(e)
            })?;
            
            if metadata.permissions().readonly() {
                let error = std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    format!("目录 {:?} 为只读", parent)
                );
                return Err(sqlx::Error::Io(error));
            }
        }

        // 打印数据库路径用于调试
        eprintln!("🔧 正在初始化数据库: {:?}", db_path);
        
        // 确保使用绝对路径
        let absolute_path = if db_path.is_absolute() {
            db_path
        } else {
            std::env::current_dir().map_err(|e| sqlx::Error::Io(e))?.join(db_path)
        };
        
        let database_url = format!("sqlite:{}?mode=rwc", absolute_path.display());
        eprintln!("🔧 数据库连接字符串: {}", database_url);
        
        // 设置 SQLite 连接选项
        let pool = SqlitePool::connect_with(
            sqlx::sqlite::SqliteConnectOptions::from_str(&database_url)
                .map_err(|e| {
                    eprintln!("❌ 解析数据库URL失败: {}", e);
                    e
                })?
                .create_if_missing(true)
                .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
                .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        ).await.map_err(|e| {
            eprintln!("❌ 连接数据库失败: {}", e);
            e
        })?;
        
        // 运行数据库迁移
        eprintln!("🔧 运行数据库迁移...");
        sqlx::migrate!("./migrations").run(&pool).await.map_err(|e| {
            eprintln!("❌ 数据库迁移失败: {}", e);
            e
        })?;
        
        eprintln!("✅ 数据库初始化成功");
        Ok(Database { connection: pool })
    }

    pub async fn create_message_test(&self, message: &MessageTest) -> Result<(), sqlx::Error> {
        let sent_at_str = message.sent_at.map(|t| t.to_rfc3339());
        let created_at_str = message.created_at.to_rfc3339();
        
        sqlx::query!(
            r#"
            INSERT INTO message_tests (id, topic, qos_level, payload, status, sent_at, response, created_at, product_key, device_name, mode, python_code, notes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            message.id,
            message.topic,
            message.qos_level,
            message.payload,
            message.status,
            sent_at_str,
            message.response,
            created_at_str,
            message.product_key,
            message.device_name,
            message.mode,
            message.python_code,
            message.notes
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn get_all_message_tests(&self) -> Result<Vec<MessageTest>, sqlx::Error> {
        let rows = sqlx::query!(
            "SELECT id, topic, qos_level, payload, status, sent_at, response, created_at, product_key, device_name, mode, python_code, notes FROM message_tests ORDER BY created_at DESC"
        )
        .fetch_all(&self.connection)
        .await?;

        let tests = rows.into_iter().map(|row| MessageTest {
            id: row.id,
            topic: row.topic,
            qos_level: row.qos_level as i32,
            payload: row.payload,
            status: row.status,
            sent_at: row.sent_at.and_then(|t| DateTime::parse_from_rfc3339(t.as_str()).ok().map(|dt| dt.with_timezone(&Utc))),
            response: row.response,
            created_at: DateTime::parse_from_rfc3339(row.created_at.as_str()).unwrap().with_timezone(&Utc),
            product_key: row.product_key,
            device_name: row.device_name,
            mode: row.mode,
            python_code: row.python_code,
            notes: row.notes,
        }).collect();

        Ok(tests)
    }

    pub async fn update_message_test_status(
        &self,
        id: &str,
        status: &str,
        sent_at: Option<DateTime<Utc>>,
        response: Option<&str>
    ) -> Result<(), sqlx::Error> {
        let sent_at_str = sent_at.map(|t| t.to_rfc3339());
        
        sqlx::query!(
            "UPDATE message_tests SET status = ?1, sent_at = ?2, response = ?3 WHERE id = ?4",
            status,
            sent_at_str,
            response,
            id
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn delete_message_test(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM message_tests WHERE id = ?1", id)
            .execute(&self.connection)
            .await?;
        
        Ok(())
    }

    pub async fn get_message_test_by_id(&self, id: &str) -> Result<Option<MessageTest>, sqlx::Error> {
        let row = sqlx::query!(
            "SELECT id, topic, qos_level, payload, status, sent_at, response, created_at, product_key, device_name, mode, python_code, notes FROM message_tests WHERE id = ?1",
            id
        )
        .fetch_optional(&self.connection)
        .await?;

        if let Some(row) = row {
            Ok(Some(MessageTest {
                id: row.id,
                topic: row.topic,
                qos_level: row.qos_level as i32,
                payload: row.payload,
                status: row.status,
                sent_at: row.sent_at.and_then(|t| DateTime::parse_from_rfc3339(t.as_str()).ok().map(|dt| dt.with_timezone(&Utc))),
                response: row.response,
                created_at: DateTime::parse_from_rfc3339(row.created_at.as_str()).unwrap().with_timezone(&Utc),
                product_key: row.product_key,
                device_name: row.device_name,
                mode: row.mode,
                python_code: row.python_code,
                notes: row.notes,
            }))
        } else {
            Ok(None)
        }
    }

    // 准确性测试相关方法
    pub async fn create_accuracy_test(&self, test: &AccuracyTest) -> Result<(), sqlx::Error> {
        let created_at_str = test.created_at.to_rfc3339();
        let completed_at_str = test.completed_at.map(|t| t.to_rfc3339());
        
        sqlx::query!(
            r#"
            INSERT INTO accuracy_tests (id, expected_text, recognized_text, similarity, result, created_at, completed_at, audio_file_path, python_code, mode, error_message, notes, audio_duration, test_mode, loop_count, scheduled_time, current_loop, auto_executed)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            "#,
            test.id,
            test.expected_text,
            test.recognized_text,
            test.similarity,
            test.result,
            created_at_str,
            completed_at_str,
            test.audio_file_path,
            test.python_code,
            test.mode,
            test.error_message,
            test.notes,
            test.audio_duration,
            test.test_mode,
            test.loop_count,
            test.scheduled_time,
            test.current_loop,
            test.auto_executed
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn get_all_accuracy_tests(&self) -> Result<Vec<AccuracyTest>, sqlx::Error> {
        let rows = sqlx::query!(
            "SELECT id, expected_text, recognized_text, similarity, result, created_at, completed_at, audio_file_path, python_code, mode, error_message, notes, audio_duration, test_mode, loop_count, scheduled_time, current_loop, auto_executed FROM accuracy_tests ORDER BY created_at DESC"
        )
        .fetch_all(&self.connection)
        .await?;

        let tests = rows.into_iter().map(|row| AccuracyTest {
            id: row.id.unwrap_or_default(),
            expected_text: row.expected_text,
            recognized_text: row.recognized_text,
            similarity: row.similarity,
            result: row.result,
            created_at: DateTime::parse_from_rfc3339(row.created_at.as_str()).unwrap().with_timezone(&Utc),
            completed_at: row.completed_at.and_then(|t| DateTime::parse_from_rfc3339(t.as_str()).ok().map(|dt| dt.with_timezone(&Utc))),
            audio_file_path: row.audio_file_path,
            python_code: row.python_code,
            mode: row.mode,
            error_message: row.error_message,
            notes: row.notes,
            audio_data: None, // 不再从数据库读取audio_data
            audio_duration: row.audio_duration,
            test_mode: row.test_mode,
            loop_count: row.loop_count.map(|v| v as i32),
            scheduled_time: row.scheduled_time,
            current_loop: row.current_loop.unwrap_or(0) as i32,
            auto_executed: row.auto_executed.unwrap_or(false),
        }).collect();

        Ok(tests)
    }

    pub async fn update_accuracy_test_result(
        &self,
        id: &str,
        recognized_text: &str,
        similarity: f64,
        result: &str,
        completed_at: DateTime<Utc>,
        error_message: Option<&str>,
        audio_file_path: Option<&str>,
        audio_duration: Option<i64>
    ) -> Result<(), sqlx::Error> {
        let completed_at_str = completed_at.to_rfc3339();
        
        sqlx::query!(
            "UPDATE accuracy_tests SET recognized_text = ?1, similarity = ?2, result = ?3, completed_at = ?4, error_message = ?5, audio_file_path = ?6, audio_duration = ?7 WHERE id = ?8",
            recognized_text,
            similarity,
            result,
            completed_at_str,
            error_message,
            audio_file_path,
            audio_duration,
            id
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn update_accuracy_test_expected_text(
        &self,
        id: &str,
        expected_text: &str,
        result: &str
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE accuracy_tests SET expected_text = ?1, result = ?2 WHERE id = ?3",
            expected_text,
            result,
            id
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn delete_accuracy_test(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM accuracy_tests WHERE id = ?1", id)
            .execute(&self.connection)
            .await?;
        
        Ok(())
    }

    pub async fn get_accuracy_test_by_id(&self, id: &str) -> Result<Option<AccuracyTest>, sqlx::Error> {
        let row = sqlx::query!(
            "SELECT id, expected_text, recognized_text, similarity, result, created_at, completed_at, audio_file_path, python_code, mode, error_message, notes, audio_duration, test_mode, loop_count, scheduled_time, current_loop, auto_executed FROM accuracy_tests WHERE id = ?1",
            id
        )
        .fetch_optional(&self.connection)
        .await?;

        if let Some(row) = row {
            Ok(Some(AccuracyTest {
                id: row.id.unwrap_or_default(),
                expected_text: row.expected_text,
                recognized_text: row.recognized_text,
                similarity: row.similarity,
                result: row.result,
                created_at: DateTime::parse_from_rfc3339(row.created_at.as_str()).unwrap().with_timezone(&Utc),
                completed_at: row.completed_at.and_then(|t| DateTime::parse_from_rfc3339(t.as_str()).ok().map(|dt| dt.with_timezone(&Utc))),
                audio_file_path: row.audio_file_path,
                python_code: row.python_code,
                mode: row.mode,
                error_message: row.error_message,
                notes: row.notes,
                audio_data: None, // 不再从数据库读取audio_data
                audio_duration: row.audio_duration,
                test_mode: row.test_mode,
                loop_count: row.loop_count.map(|v| v as i32),
                scheduled_time: row.scheduled_time,
                current_loop: row.current_loop.unwrap_or(0) as i32,
                auto_executed: row.auto_executed.unwrap_or(false),
            }))
        } else {
            Ok(None)
        }
    }

    // 配置相关方法
    pub async fn save_config(&self, config_type: &str, config_data: &str) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        sqlx::query!(
            r#"
            INSERT INTO configs (config_type, config_data, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(config_type) 
            DO UPDATE SET 
                config_data = excluded.config_data,
                updated_at = excluded.updated_at
            "#,
            config_type,
            config_data,
            now,
            now
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn load_config(&self, config_type: &str) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query!(
            "SELECT config_data FROM configs WHERE config_type = ?1",
            config_type
        )
        .fetch_optional(&self.connection)
        .await?;
        
        Ok(row.map(|r| r.config_data))
    }

    pub async fn delete_config(&self, config_type: &str) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "DELETE FROM configs WHERE config_type = ?1",
            config_type
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn get_all_configs(&self) -> Result<Vec<ConfigRecord>, sqlx::Error> {
        let rows = sqlx::query!(
            "SELECT id, config_type, config_data, created_at, updated_at FROM configs ORDER BY config_type"
        )
        .fetch_all(&self.connection)
        .await?;

        let configs = rows.into_iter().map(|row| ConfigRecord {
            id: row.id.unwrap_or(0),
            config_type: row.config_type,
            config_data: row.config_data,
            created_at: DateTime::parse_from_rfc3339(&row.created_at).unwrap().with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at).unwrap().with_timezone(&Utc),
        }).collect();

        Ok(configs)
    }

    // 变量管理相关方法
    pub async fn get_all_variables(&self) -> Result<Vec<Variable>, sqlx::Error> {
        let rows = sqlx::query!(
            "SELECT id, name, value, description, is_default, created_at, updated_at FROM variables ORDER BY is_default DESC, name ASC"
        )
        .fetch_all(&self.connection)
        .await?;

        let variables = rows.into_iter().map(|row| Variable {
            id: row.id,
            name: row.name,
            value: row.value,
            description: row.description,
            is_default: row.is_default,
            created_at: DateTime::parse_from_rfc3339(&row.created_at).unwrap().with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&row.updated_at).unwrap().with_timezone(&Utc),
        }).collect();

        Ok(variables)
    }

    pub async fn create_variable(&self, name: &str, value: &str, description: Option<&str>) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        sqlx::query!(
            r#"
            INSERT INTO variables (name, value, description, is_default, created_at, updated_at)
            VALUES (?1, ?2, ?3, FALSE, ?4, ?5)
            "#,
            name,
            value,
            description,
            now,
            now
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn update_variable(&self, id: i64, name: &str, value: &str, description: Option<&str>) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        sqlx::query!(
            "UPDATE variables SET name = ?1, value = ?2, description = ?3, updated_at = ?4 WHERE id = ?5",
            name,
            value,
            description,
            now,
            id
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn delete_variable(&self, id: i64) -> Result<(), sqlx::Error> {
        // 不能删除默认变量
        sqlx::query!(
            "DELETE FROM variables WHERE id = ?1 AND is_default = FALSE",
            id
        )
        .execute(&self.connection)
        .await?;
        
        Ok(())
    }

    pub async fn get_variable_by_name(&self, name: &str) -> Result<Option<Variable>, sqlx::Error> {
        let row = sqlx::query!(
            "SELECT id, name, value, description, is_default, created_at, updated_at FROM variables WHERE UPPER(name) = UPPER(?1)",
            name
        )
        .fetch_optional(&self.connection)
        .await?;

        if let Some(row) = row {
            Ok(Some(Variable {
                id: row.id,
                name: row.name,
                value: row.value,
                description: row.description,
                is_default: row.is_default,
                created_at: DateTime::parse_from_rfc3339(&row.created_at).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.updated_at).unwrap().with_timezone(&Utc),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn save_user_preference(&self, preference_type: &str, preference_data: &str) -> Result<(), sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        
        // Check if preference already exists
        let existing = sqlx::query!(
            "SELECT id FROM user_preferences WHERE preference_type = ?",
            preference_type
        )
        .fetch_optional(&self.connection)
        .await?;
        
        if let Some(record) = existing {
            // Update existing preference
            sqlx::query!(
                "UPDATE user_preferences SET preference_data = ?, updated_at = ? WHERE id = ?",
                preference_data,
                now,
                record.id
            )
            .execute(&self.connection)
            .await?;
        } else {
            // Create new preference
            sqlx::query!(
                "INSERT INTO user_preferences (preference_type, preference_data, created_at, updated_at) VALUES (?, ?, ?, ?)",
                preference_type,
                preference_data,
                now,
                now
            )
            .execute(&self.connection)
            .await?;
        }
        
        Ok(())
    }
    
    pub async fn load_user_preference(&self, preference_type: &str) -> Result<Option<String>, sqlx::Error> {
        let record = sqlx::query!(
            "SELECT preference_data FROM user_preferences WHERE preference_type = ?",
            preference_type
        )
        .fetch_optional(&self.connection)
        .await?;
        
        Ok(record.map(|r| r.preference_data))
    }
}

// 加密配置相关函数
fn get_config_encryption_key() -> [u8; 32] {
    let machine_id = get_config_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(b"testx_config_salt_2024"); // 添加盐值
    let result = hasher.finalize();
    result.into()
}

fn get_config_machine_id() -> String {
    // 简单的机器标识生成，实际项目中可能需要更复杂的方法
    format!("{}_{}", 
        std::env::var("USER").or_else(|_| std::env::var("USERNAME")).unwrap_or_default(),
        "testx_app"
    )
}

pub fn encrypt_config_data(data: &str) -> Result<String, String> {
    let key = get_config_encryption_key();
    let iv: [u8; 16] = rand::thread_rng().gen();
    
    let cipher = Aes256CbcEnc::new(&key.into(), &iv.into());
    
    // 添加PKCS7填充
    let mut buffer = data.as_bytes().to_vec();
    let padding_len = 16 - (buffer.len() % 16);
    buffer.extend(vec![padding_len as u8; padding_len]);
    
    let buffer_len = buffer.len(); // 先获取长度
    let encrypted = cipher.encrypt_padded_mut::<cbc::cipher::block_padding::NoPadding>(&mut buffer, buffer_len)
        .map_err(|e| format!("加密失败: {}", e))?;
    
    // 组合 IV + 加密数据
    let mut result = iv.to_vec();
    result.extend_from_slice(encrypted);
    
    Ok(hex::encode(result))
}

pub fn decrypt_config_data(encrypted_hex: &str) -> Result<String, String> {
    let encrypted_data = hex::decode(encrypted_hex)
        .map_err(|e| format!("十六进制解码失败: {}", e))?;
    
    if encrypted_data.len() < 16 {
        return Err("加密数据格式错误".to_string());
    }
    
    let (iv, encrypted) = encrypted_data.split_at(16);
    let key = get_config_encryption_key();
    
    let cipher = Aes256CbcDec::new(&key.into(), iv.try_into().unwrap());
    
    let mut buffer = encrypted.to_vec();
    let decrypted = cipher.decrypt_padded_mut::<cbc::cipher::block_padding::NoPadding>(&mut buffer)
        .map_err(|e| format!("解密失败: {}", e))?;
    
    // 移除PKCS7填充
    let padding_len = *decrypted.last().unwrap_or(&0) as usize;
    if padding_len > 16 || padding_len == 0 {
        return Err("填充格式错误".to_string());
    }
    
    let data_len = decrypted.len() - padding_len;
    let data = &decrypted[..data_len];
    
    String::from_utf8(data.to_vec())
        .map_err(|e| format!("UTF-8解码失败: {}", e))
}