import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import type { SpeechConfig } from '@/types/config';

const ApiConfig = () => {
  const [config, setConfig] = useState<SpeechConfig>({
    app_id: '',
    secret_id: '',
    secret_key: '',
    region: 'cn-guangzhou',
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
      const savedConfig = await invoke<SpeechConfig | null>('load_speech_config');
      if (savedConfig) {
        setConfig(savedConfig);
        setIsConfigLoaded(true);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      toast.error('加载配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // 验证必填字段
    if (!config.app_id || !config.secret_id || !config.secret_key) {
      toast.error('请填写所有必填字段');
      return;
    }

    setIsSaving(true);
    try {
      await invoke('save_speech_config', { config });
      setIsConfigLoaded(true);
      toast.success('语音识别配置保存成功', {
        description: '配置已加密保存到本地'
      });
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error('保存配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await invoke('delete_config', { configType: 'speech' });
      setConfig({
        app_id: '',
        secret_id: '',
        secret_key: '',
        region: 'cn-guangzhou',
      });
      setIsConfigLoaded(false);
      toast.success('配置已删除');
    } catch (error) {
      console.error('删除配置失败:', error);
      toast.error('删除配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (field: keyof SpeechConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          腾讯云语音识别配置
          {isConfigLoaded && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDelete}
              disabled={isLoading}
            >
              删除配置
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="provider">API Provider</Label>
          <Select defaultValue="qcloud" disabled>
            <SelectTrigger>
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qcloud">腾讯云ASR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appId">App ID *</Label>
          <Input
            id="appId"
            type="text"
            placeholder="请输入腾讯云 App ID"
            value={config.app_id}
            onChange={(e) => updateConfig('app_id', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secretId">Secret ID *</Label>
          <Input
            id="secretId"
            type="password"
            placeholder="请输入腾讯云 Secret ID"
            value={config.secret_id}
            onChange={(e) => updateConfig('secret_id', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secretKey">Secret Key *</Label>
          <Input
            id="secretKey"
            type="password"
            placeholder="请输入腾讯云 Secret Key"
            value={config.secret_key}
            onChange={(e) => updateConfig('secret_key', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select 
            value={config.region} 
            onValueChange={(value) => updateConfig('region', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择地域" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cn-guangzhou">华南地区(广州)</SelectItem>
              <SelectItem value="cn-beijing">华北地区(北京)</SelectItem>
              <SelectItem value="cn-shanghai">华东地区(上海)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || isLoading}
            className="flex-1"
          >
            {isSaving ? '保存中...' : '保存配置'}
          </Button>
          <Button 
            variant="outline" 
            onClick={loadConfig}
            disabled={isLoading}
          >
            {isLoading ? '加载中...' : '重新加载'}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>* 为必填字段</p>
          <p>配置将加密保存在本地，确保您的密钥安全。</p>
          <p className="mt-2">
            <strong>获取方式：</strong><br />
            1. 登录 <a href="https://console.cloud.tencent.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">腾讯云控制台</a><br />
            2. 前往 <a href="https://console.cloud.tencent.com/asr" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">语音识别服务</a><br />
            3. 在 <a href="https://console.cloud.tencent.com/cam/capi" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">访问管理</a> 获取密钥
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiConfig; 