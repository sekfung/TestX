import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

interface RecognitionConfig {
  engine_type: string;
  voice_format: string;
  sample_rate: string;
  speaker_diarization: boolean;
  filter_dirty: boolean;
  filter_modal: boolean;
  filter_punc: boolean;
  convert_num_mode: boolean;
  word_info: boolean;
  first_channel_only: boolean;
}

const RecognitionSettings = () => {
  const [config, setConfig] = useState<RecognitionConfig>({
    engine_type: '16k_zh',
    voice_format: 'wav',
    sample_rate: '16000',
    speaker_diarization: false,
    filter_dirty: false,
    filter_modal: false,
    filter_punc: true,
    convert_num_mode: true,
    word_info: true,
    first_channel_only: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const savedConfig = await invoke<RecognitionConfig | null>('load_recognition_config');
      if (savedConfig) {
        setConfig(savedConfig);
        setIsConfigLoaded(true);
      }
    } catch (error) {
      console.error('加载识别设置失败:', error);
      toast.error('加载识别设置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await invoke('save_recognition_config', { config });
      setIsConfigLoaded(true);
      toast.success('识别设置保存成功', {
        description: '设置已保存到本地'
      });
    } catch (error) {
      console.error('保存识别设置失败:', error);
      toast.error('保存识别设置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await invoke('delete_config', { configType: 'recognition' });
      setConfig({
        engine_type: '16k_zh',
        voice_format: 'wav',
        sample_rate: '16000',
        speaker_diarization: false,
        filter_dirty: false,
        filter_modal: false,
        filter_punc: true,
        convert_num_mode: true,
        word_info: true,
        first_channel_only: true,
      });
      setIsConfigLoaded(false);
      toast.success('识别设置已重置为默认值');
    } catch (error) {
      console.error('删除识别设置失败:', error);
      toast.error('删除识别设置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (field: keyof RecognitionConfig, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 语言类型选项（基于腾讯云文档的 engine_type 参数）
  const languageOptions = [
    { value: '16k_zh', label: '中文普通话' },
    { value: '16k_zh_dialect', label: '中文方言' },
    { value: '16k_en', label: '英语' },
    { value: '16k_ca', label: '粤语' },
    { value: '16k_ja', label: '日语' },
    { value: '16k_ko', label: '韩语' },
    { value: '16k_th', label: '泰语' },
    { value: '16k_id', label: '印度尼西亚语' },
    { value: '16k_vi', label: '越南语' },
    { value: '16k_ms', label: '马来语' },
    { value: '16k_fil', label: '菲律宾语' },
    { value: '16k_pt', label: '葡萄牙语' },
    { value: '16k_tr', label: '土耳其语' },
    { value: '16k_ar', label: '阿拉伯语' },
    { value: '16k_es', label: '西班牙语' },
    { value: '16k_hi', label: '印地语' },
    { value: '16k_fr', label: '法语' },
    { value: '16k_de', label: '德语' },
    { value: '16k_zh-PY', label: '上海话' },
    { value: '16k_zh-CY', label: '四川话' },
    { value: '16k_zh-WH', label: '武汉话' },
    { value: '16k_zh-GY', label: '贵阳话' },
    { value: '16k_zh-KM', label: '昆明话' },
    { value: '16k_zh-XA', label: '西安话' },
    { value: '16k_zh-ZZ', label: '郑州话' },
    { value: '16k_zh-TY', label: '太原话' },
    { value: '16k_zh-LZ', label: '兰州话' },
    { value: '16k_zh-YC', label: '银川话' },
    { value: '16k_zh-XN', label: '西宁话' },
    { value: '16k_zh-NJ', label: '南京话' },
    { value: '16k_zh-HF', label: '合肥话' },
    { value: '16k_zh-NC', label: '南昌话' },
    { value: '16k_zh-CS', label: '长沙话' },
    { value: '16k_zh-SZ', label: '苏州话' },
    { value: '16k_zh-HZ', label: '杭州话' },
    { value: '16k_zh-JN', label: '济南话' },
    { value: '16k_zh-TJ', label: '天津话' },
    { value: '16k_zh-SJZ', label: '石家庄话' },
    { value: '16k_zh-HLJ', label: '黑龙江话' },
    { value: '16k_zh-JL', label: '吉林话' },
    { value: '16k_zh-LN', label: '辽宁话' },
  ];

  return (
    <CardContent className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">识别参数设置</h3>
        {isConfigLoaded && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={isLoading}
          >
            重置设置
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 识别语言类型 */}
        <div className="space-y-2">
          <Label htmlFor="engine_type">识别语言类型</Label>
          <Select 
            value={config.engine_type} 
            onValueChange={(value) => updateConfig('engine_type', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择识别语言" />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 音频格式 */}
        <div className="space-y-2">
          <Label htmlFor="voice_format">音频格式</Label>
          <Select 
            value={config.voice_format} 
            onValueChange={(value) => updateConfig('voice_format', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择音频格式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wav">WAV</SelectItem>
              <SelectItem value="pcm">PCM</SelectItem>
              <SelectItem value="ogg-opus">OGG-OPUS</SelectItem>
              <SelectItem value="speex">SPEEX</SelectItem>
              <SelectItem value="silk">SILK</SelectItem>
              <SelectItem value="mp3">MP3</SelectItem>
              <SelectItem value="m4a">M4A</SelectItem>
              <SelectItem value="aac">AAC</SelectItem>
              <SelectItem value="amr">AMR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 采样率 */}
        <div className="space-y-2">
          <Label htmlFor="sample_rate">采样率</Label>
          <Select 
            value={config.sample_rate} 
            onValueChange={(value) => updateConfig('sample_rate', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择采样率" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8000">8000 Hz</SelectItem>
              <SelectItem value="16000">16000 Hz</SelectItem>
              <SelectItem value="44100">44100 Hz</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 开关设置 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="speaker_diarization">说话人分离</Label>
            <div className="text-sm text-muted-foreground">
              区分不同说话人
            </div>
          </div>
          <Switch
            id="speaker_diarization"
            checked={config.speaker_diarization}
            onCheckedChange={(checked) => updateConfig('speaker_diarization', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="filter_dirty">脏词过滤</Label>
            <div className="text-sm text-muted-foreground">
              过滤识别结果中的脏词
            </div>
          </div>
          <Switch
            id="filter_dirty"
            checked={config.filter_dirty}
            onCheckedChange={(checked) => updateConfig('filter_dirty', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="filter_modal">语气词过滤</Label>
            <div className="text-sm text-muted-foreground">
              过滤"呃"、"啊"等语气词
            </div>
          </div>
          <Switch
            id="filter_modal"
            checked={config.filter_modal}
            onCheckedChange={(checked) => updateConfig('filter_modal', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="filter_punc">标点符号过滤</Label>
            <div className="text-sm text-muted-foreground">
              过滤识别结果中的标点符号
            </div>
          </div>
          <Switch
            id="filter_punc"
            checked={config.filter_punc}
            onCheckedChange={(checked) => updateConfig('filter_punc', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="convert_num_mode">数字转换</Label>
            <div className="text-sm text-muted-foreground">
              将阿拉伯数字转为中文数字
            </div>
          </div>
          <Switch
            id="convert_num_mode"
            checked={config.convert_num_mode}
            onCheckedChange={(checked) => updateConfig('convert_num_mode', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="word_info">词级时间戳</Label>
            <div className="text-sm text-muted-foreground">
              输出词级别的时间戳信息
            </div>
          </div>
          <Switch
            id="word_info"
            checked={config.word_info}
            onCheckedChange={(checked) => updateConfig('word_info', checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="first_channel_only">仅识别首声道</Label>
            <div className="text-sm text-muted-foreground">
              对于多声道音频仅识别首声道
            </div>
          </div>
          <Switch
            id="first_channel_only"
            checked={config.first_channel_only}
            onCheckedChange={(checked) => updateConfig('first_channel_only', checked)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || isLoading}
          className="flex-1"
        >
          {isSaving ? '保存中...' : '保存设置'}
        </Button>
        <Button 
          variant="outline" 
          onClick={loadConfig}
          disabled={isLoading}
        >
          {isLoading ? '加载中...' : '重新加载'}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>设置将保存到本地，在进行语音识别时自动应用。</p>
        <p><strong>推荐设置：</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>语言类型：根据实际使用场景选择</li>
          <li>音频格式：WAV（兼容性最好）</li>
          <li>采样率：16000 Hz（推荐）</li>
          <li>词级时间戳：启用（获得更详细信息）</li>
          <li>数字转换：启用（便于阅读）</li>
        </ul>
      </div>
    </CardContent>
  );
};

export default RecognitionSettings; 