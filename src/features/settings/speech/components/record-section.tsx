import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { SpeechRecorder, createSpeechRecorder } from '@/lib/speech-recorder';

interface Props {
  onRecognitionResult: (text: string) => void;
}

export default function RecordSection({ onRecognitionResult }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const speechRecorderRef = useRef<SpeechRecorder | null>(null);

  const startRecording = async () => {
    try {
      // 创建语音录音器实例
       const recorder = createSpeechRecorder({
         recordingMode: 'webaudio',
         autoRecognize: true,
         maxDuration: 60000, // 60秒限制
         stopOnRecognition: true, // 识别完成后立即停止
         onRecognitionResult: (result: string) => {
           onRecognitionResult(result);
           setIsProcessing(false);
         },
         onRecognitionError: (error: string) => {
           onRecognitionResult(`识别失败: ${error}`);
           setIsProcessing(false);
         }
       });
      
      speechRecorderRef.current = recorder;
      setIsRecording(true);
      
      await recorder.startRecording(
        (result) => {
          // 录音完成回调
          setIsRecording(false);
          if (result.recognitionResult) {
            setIsProcessing(false);
          } else {
            setIsProcessing(true);
          }
        },
        (error) => {
          // 录音错误回调
          setIsRecording(false);
          setIsProcessing(false);
          onRecognitionResult(`录音失败: ${error.message}`);
        }
      );
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setIsRecording(false);
      setIsProcessing(false);
      onRecognitionResult('录音启动失败，请重试');
    }
  };

  const stopRecording = async () => {
    if (speechRecorderRef.current && isRecording) {
      setIsProcessing(true);
      toast.info('录音已停止', {
        description: '正在处理音频数据，请稍候...'
      });
      
      await speechRecorderRef.current.stopRecording();
      speechRecorderRef.current = null;
    }
  };

  // 音频处理和识别逻辑已移至 SpeechRecorder 模块中

  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex items-center justify-center p-6">
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              识别中...
            </>
          ) : isRecording ? (
            <>
              <Square className="mr-2 h-5 w-5" />
              停止录音
            </>
          ) : (
            <>
              <Mic className="mr-2 h-5 w-5" />
              开始录音
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}