import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Workflow, Settings2 } from 'lucide-react';
import ContentSection from '../components/content-section';
import SpeechWizard from './components/speech-wizard';
import ApiConfig from './components/api-config';
import RecognitionSettings from './components/recognition-settings';
import Hotwords from './components/hotwords';
import RecordSection from './components/record-section';
import RecognitionResult from './components/recognition-result';

export default function SettingsSpeech() {
  const [recognitionText, setRecognitionText] = useState('');
  const [viewMode, setViewMode] = useState<'wizard' | 'tabs'>('wizard');

  return (
    <ContentSection
      title="语音识别"
      desc="配置语音识别服务的 API 参数、热词列表和识别设置。"
    >
      <div className="space-y-6">
        {/* 视图切换 */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex space-x-2">
            <Button
              variant={viewMode === 'wizard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('wizard')}
              className="flex items-center space-x-2"
            >
              <Workflow className="h-4 w-4" />
              <span>向导模式</span>
            </Button>
            <Button
              variant={viewMode === 'tabs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tabs')}
              className="flex items-center space-x-2"
            >
              <Settings2 className="h-4 w-4" />
              <span>高级模式</span>
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {viewMode === 'wizard' 
              ? '按步骤完成语音识别配置' 
              : '快速访问各项配置功能'
            }
          </div>
        </div>

        {/* 内容区域 */}
        {viewMode === 'wizard' ? (
          <SpeechWizard />
        ) : (
          <Tabs defaultValue="api" className="space-y-4">
            <TabsList>
              <TabsTrigger value="api">API 配置</TabsTrigger>
              <TabsTrigger value="settings">识别设置</TabsTrigger>
              <TabsTrigger value="hotwords">热词设置</TabsTrigger>
              <TabsTrigger value="recognition">语音识别</TabsTrigger>
            </TabsList>

            <TabsContent value="api">
              <ApiConfig />
            </TabsContent>

            <TabsContent value="settings">
              <RecognitionSettings />
            </TabsContent>

            <TabsContent value="hotwords">
              <Hotwords />
            </TabsContent>

            <TabsContent value="recognition" className="space-y-4">
              <RecordSection onRecognitionResult={setRecognitionText} />
              <RecognitionResult text={recognitionText} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ContentSection>
  );
} 