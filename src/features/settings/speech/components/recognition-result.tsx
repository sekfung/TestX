import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface Props {
  text: string;
}

export default function RecognitionResult({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (text && text !== '等待识别结果...') {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('复制失败:', err);
      }
    }
  };

  const isEmpty = !text || text === '等待识别结果...';

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">识别结果</CardTitle>
          {!isEmpty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  复制
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className={`min-h-[120px] p-4 rounded-md border whitespace-pre-wrap ${
            isEmpty 
              ? 'bg-muted/30 text-muted-foreground text-center flex items-center justify-center' 
              : 'bg-background'
          }`}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-lg">🎤</div>
              <span>等待识别结果...</span>
              <span className="text-sm">点击"开始录音"按钮开始语音识别</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">
                识别文本：
              </div>
              <div className="text-base leading-relaxed">
                {text}
              </div>
              <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">
                字数：{text.length} | 使用腾讯云语音识别服务
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 