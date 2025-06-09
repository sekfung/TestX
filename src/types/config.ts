export interface SpeechConfig {
  app_id: string
  secret_id: string
  secret_key: string
  region: string
}

export interface IoTConfig {
  platform: string
  access_key_id: string
  access_key_secret: string
  region_id: string
  instance_id: string
}

export interface ConfigStatus {
  speech_configured: boolean
  iot_configured: boolean
}

export interface RecognitionConfig {
  engine_type: string
  voice_format: string
  sample_rate: string
  speaker_diarization: boolean
  filter_dirty: boolean
  filter_modal: boolean
  filter_punc: boolean
  convert_num_mode: boolean
  word_info: boolean
  first_channel_only: boolean
}

export interface HotwordItem {
  word: string
  weight: number
}

export interface HotwordConfig {
  hotwords: HotwordItem[]
} 