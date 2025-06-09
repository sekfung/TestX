import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import type { IoTConfig } from '@/types/config';

export function IoTForm() {
  const [config, setConfig] = useState<IoTConfig>({
    platform: 'aliyun',
    access_key_id: '',
    access_key_secret: '',
    region_id: 'cn-shanghai',
    instance_id: '',
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
      const savedConfig = await invoke<IoTConfig | null>('load_iot_config');
      if (savedConfig) {
        // 确保region_id有默认值
        const configWithDefaults = {
          ...savedConfig,
          region_id: savedConfig.region_id || 'cn-shanghai'
        };
        setConfig(configWithDefaults);
        setIsConfigLoaded(true);
      }
    } catch (error) {
      console.error('加载 IoT 配置失败:', error);
      toast.error('加载 IoT 配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // 验证必填字段
    if (!config.access_key_id || !config.access_key_secret) {
      toast.error('请填写所有必填字段');
      return;
    }

    // 确保region_id有值，没有则使用默认值
    const configToSave = {
      ...config,
      region_id: config.region_id || 'cn-shanghai'
    };

    setIsSaving(true);
    try {
      await invoke('save_iot_config', { config: configToSave });
      setIsConfigLoaded(true);
      toast.success('IoT 配置保存成功', {
        description: '配置已加密保存到本地'
      });
    } catch (error) {
      console.error('保存 IoT 配置失败:', error);
      toast.error('保存 IoT 配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await invoke('delete_config', { configType: 'iot' });
      setConfig({
        platform: 'aliyun',
        access_key_id: '',
        access_key_secret: '',
        region_id: 'cn-shanghai',
        instance_id: '',
      });
      setIsConfigLoaded(false);
      toast.success('IoT 配置已删除');
    } catch (error) {
      console.error('删除 IoT 配置失败:', error);
      toast.error('删除 IoT 配置失败', {
        description: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (field: keyof IoTConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          阿里云 IoT 平台配置
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
      <CardContent>
        <form className="space-y-6">
          <div className="space-y-2">
            <Label>IoT 平台</Label>
            <Select 
              value={config.platform} 
              onValueChange={(value) => updateConfig('platform', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 IoT 平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aliyun">阿里云 IoT 平台</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Access Key ID *</Label>
            <Input 
              type="password" 
              placeholder="输入阿里云 Access Key ID"
              value={config.access_key_id}
              onChange={(e) => updateConfig('access_key_id', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Access Key Secret *</Label>
            <Input 
              type="password" 
              placeholder="输入阿里云 Access Key Secret"
              value={config.access_key_secret}
              onChange={(e) => updateConfig('access_key_secret', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>区域 ID</Label>
            <Select 
              value={config.region_id} 
              onValueChange={(value) => updateConfig('region_id', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择区域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cn-shanghai">华东1(上海)</SelectItem>
                <SelectItem value="cn-beijing">华北2(北京)</SelectItem>
                <SelectItem value="cn-hangzhou">华东1(杭州)</SelectItem>
                <SelectItem value="cn-shenzhen">华南1(深圳)</SelectItem>
                <SelectItem value="cn-qingdao">华北1(青岛)</SelectItem>
                <SelectItem value="cn-zhangjiakou">华北3(张家口)</SelectItem>
                <SelectItem value="cn-huhehaote">华北5(呼和浩特)</SelectItem>
                <SelectItem value="cn-chengdu">西南1(成都)</SelectItem>
                <SelectItem value="cn-hongkong">香港</SelectItem>
                <SelectItem value="ap-southeast-1">新加坡</SelectItem>
                <SelectItem value="ap-southeast-2">悉尼</SelectItem>
                <SelectItem value="ap-southeast-3">吉隆坡</SelectItem>
                <SelectItem value="ap-southeast-5">雅加达</SelectItem>
                <SelectItem value="ap-northeast-1">东京</SelectItem>
                <SelectItem value="ap-south-1">孟买</SelectItem>
                <SelectItem value="eu-central-1">法兰克福</SelectItem>
                <SelectItem value="eu-west-1">伦敦</SelectItem>
                <SelectItem value="us-west-1">硅谷</SelectItem>
                <SelectItem value="us-east-1">弗吉尼亚</SelectItem>
                <SelectItem value="me-east-1">迪拜</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>实例 ID (可选)</Label>
            <Input 
              type="text" 
              placeholder="输入实例 ID（可选）"
              value={config.instance_id}
              onChange={(e) => updateConfig('instance_id', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="button"
              onClick={handleSave} 
              disabled={isSaving || isLoading}
              className="flex-1"
            >
              {isSaving ? '保存中...' : '保存配置'}
            </Button>
            <Button 
              type="button"
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
              <strong>字段说明：</strong><br />
              • <strong>区域 ID</strong>：阿里云IoT平台服务区域，默认为华东1(上海)<br />
              • <strong>实例 ID</strong>：仅在使用专有云或企业版实例时需要填写，公共云实例可留空
            </p>
            <p className="mt-2">
              <strong>阿里云获取方式：</strong><br />
              1. 登录 <a href="https://iot.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">阿里云 IoT 控制台</a><br />
              2. 在 <a href="https://ram.console.aliyun.com/manage/ak" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">访问控制 RAM</a> 获取 AccessKey
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 