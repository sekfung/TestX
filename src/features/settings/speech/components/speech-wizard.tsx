import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Steps, StepContent, StepActions, type Step } from '@/components/ui/steps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Settings, Mic, Volume2, Zap } from 'lucide-react';
import { toast } from 'sonner';

// 导入现有组件
import ApiConfig from './api-config';
import RecognitionSettings from './recognition-settings';
import Hotwords from './hotwords';
import RecordSection from './record-section';
import RecognitionResult from './recognition-result';

export default function SpeechWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [recognitionResult, setRecognitionResult] = useState('');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps: Step[] = [
    {
      id: 'api-config',
      title: '配置API',
      description: '设置腾讯云API密钥',
      status: currentStep === 0 ? 'current' : completedSteps.includes(0) ? 'finished' : 'waiting',
    },
    {
      id: 'recognition-config',
      title: '识别配置',
      description: '设置识别参数',
      status: currentStep === 1 ? 'current' : completedSteps.includes(1) ? 'finished' : 'waiting',
    },
    {
      id: 'hotwords',
      title: '热词设置',
      description: '添加自定义热词',
      status: currentStep === 2 ? 'current' : completedSteps.includes(2) ? 'finished' : 'waiting',
    },
    {
      id: 'speech-recognition',
      title: '语音识别',
      description: '开始识别测试',
      status: currentStep === 3 ? 'current' : completedSteps.includes(3) ? 'finished' : 'waiting',
    },
  ];

  // 检查步骤是否可以前进
  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: // API配置步骤
        // 这里可以添加检查API配置是否完成的逻辑
        return true;
      case 1: // 识别配置步骤
        return true;
      case 2: // 热词设置步骤（可选）
        return true;
      case 3: // 语音识别步骤
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceed(currentStep)) {
      // 标记当前步骤为完成
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
      toast.success(`${steps[currentStep].title} 已完成`);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">API 配置</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                配置腾讯云语音识别服务的API密钥信息。请确保您已经在腾讯云控制台开通了语音识别服务。
              </p>
              <ApiConfig />
            </div>
          </StepContent>
        );

      case 1:
        return (
          <StepContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Volume2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">识别配置</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                设置语音识别的相关参数，包括语言类型、音频格式等选项。
              </p>
              <RecognitionSettings />
            </div>
          </StepContent>
        );

      case 2:
        return (
          <StepContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">热词设置</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                添加专业术语或自定义词汇，提高特定场景下的识别准确率。此步骤为可选配置。
              </p>
              <Hotwords />
            </div>
          </StepContent>
        );

      case 3:
        return (
          <StepContent>
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <Mic className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">语音识别</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                现在可以开始测试语音识别功能。点击录音按钮开始录制，说话完成后停止录音即可获得识别结果。
              </p>
              
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">录音控制</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecordSection onRecognitionResult={setRecognitionResult} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">识别结果</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecognitionResult text={recognitionResult} />
                  </CardContent>
                </Card>
              </div>

              {recognitionResult && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-green-800 dark:text-green-200 font-medium">
                    🎉 语音识别测试成功！您已完成所有配置步骤。
                  </p>
                </div>
              )}
            </div>
          </StepContent>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* 步骤条 */}
      <Steps 
        steps={steps} 
        className="mb-8"
      />

      {/* 步骤内容 */}
      {renderStepContent()}

      {/* 操作按钮 */}
      <StepActions>
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>上一步</span>
        </Button>

        <div className="flex space-x-2">
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="flex items-center space-x-2"
            >
              <span>下一步</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (recognitionResult) {
                  setCompletedSteps(prev => [...prev, currentStep]);
                  toast.success('🎉 语音识别配置全部完成！');
                } else {
                  toast.info('请先完成一次语音识别测试');
                }
              }}
              className="flex items-center space-x-2"
            >
              <span>完成配置</span>
            </Button>
          )}
        </div>
      </StepActions>

      {/* 进度提示 */}
      <div className="text-center text-sm text-muted-foreground">
        步骤 {currentStep + 1} / {steps.length}：{steps[currentStep].title}
      </div>
    </div>
  );
}