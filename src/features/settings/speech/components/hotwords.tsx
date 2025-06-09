import { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, AlertCircle, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

interface HotwordItem {
  word: string;
  weight: number;
}

interface HotwordConfig {
  hotwords: HotwordItem[];
}

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

const Hotwords = () => {
  const [hotwords, setHotwords] = useState<HotwordItem[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newWeight, setNewWeight] = useState(5);
  const [currentEngine, setCurrentEngine] = useState<string>('16k_zh');

  // 检查引擎是否支持热词功能
  const isHotwordSupported = (engineType: string): boolean => {
    const supportedEngines = [
      '8k_zh', '16k_zh', '8k_zh_large', '16k_zh_large',
      '16k_zh_dialect', '16k_ca', // 中文相关引擎
    ];
    return supportedEngines.includes(engineType);
  };

  // 加载热词配置和当前引擎设置
  useEffect(() => {
    loadHotwordConfig();
    loadCurrentEngine();
  }, []);

  const loadHotwordConfig = async () => {
    try {
      const config = await invoke<HotwordConfig>('load_hotword_config');
      setHotwords(config.hotwords || []);
    } catch (error) {
      console.error('加载热词配置失败:', error);
      toast.error(`加载热词配置失败: ${error}`);
    }
  };

  const loadCurrentEngine = async () => {
    try {
      const config = await invoke<RecognitionConfig>('load_recognition_config');
      setCurrentEngine(config.engine_type);
    } catch (error) {
      console.error('加载识别引擎配置失败:', error);
      // 使用默认值，不显示错误
    }
  };

  const saveHotwordConfig = async () => {
    try {
      await invoke('save_hotword_config', { config: { hotwords } });
      toast.success('热词配置保存成功');
    } catch (error) {
      toast.error(`保存失败: ${error}`);
    }
  };

  // 验证热词格式
  const validateHotword = (word: string): string | null => {
    if (!word.trim()) {
      return '热词不能为空';
    }
    
    // 腾讯云要求：热词长度不超过10个字符
    if (word.length > 10) {
      return '热词长度不能超过10个字符';
    }
    
    // 检查是否包含特殊字符（只允许中文、英文、数字）
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/;
    if (!validPattern.test(word)) {
      return '热词只能包含中文、英文、数字，不能包含特殊字符';
    }
    
    // 检查是否已存在
    if (hotwords.some(item => item.word === word)) {
      return '该热词已存在';
    }
    
    return null;
  };

  const addHotword = () => {
    const error = validateHotword(newWord);
    if (error) {
      toast.error(error);
      return;
    }

    // 腾讯云限制：热词列表最多128个
    if (hotwords.length >= 128) {
      toast.error('热词列表最多支持128个热词');
      return;
    }

    // 检查权重100的数量警告
    if (newWeight === 100) {
      const weight100Count = hotwords.filter(item => item.weight === 100).length;
      if (weight100Count >= 5) {
        toast.warning('已有多个权重为100的热词，过多的最高权重热词可能影响整体识别准确率');
      }
    }

    const newHotword: HotwordItem = {
      word: newWord.trim(),
      weight: newWeight
    };

    setHotwords([...hotwords, newHotword]);
    setNewWord('');
    setNewWeight(5);
    toast.success('热词添加成功');
  };

  const removeHotword = (index: number) => {
    const newHotwords = hotwords.filter((_, i) => i !== index);
    setHotwords(newHotwords);
    toast.success('热词删除成功');
  };

  const updateWeight = (index: number, weight: number) => {
    const newHotwords = [...hotwords];
    const oldWeight = newHotwords[index].weight;
    newHotwords[index].weight = weight;
    
    // 权重100的特殊提示
    if (weight === 100 && oldWeight !== 100) {
      const weight100Count = newHotwords.filter(item => item.weight === 100).length;
      if (weight100Count > 5) {
        toast.warning('权重100将启用同音替换功能，过多设置可能影响识别准确率');
      } else {
        toast.info('权重100将启用热词增强同音替换功能');
      }
    }
    
    setHotwords(newHotwords);
  };

  // 获取权重100的热词数量
  const weight100Count = hotwords.filter(item => item.weight === 100).length;

  // 刷新引擎状态（供外部调用）
  const refreshEngineStatus = () => {
    loadCurrentEngine();
  };

  return (
    <CardContent className="space-y-6">
      {/* 热词规则说明 */}
      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-blue-900 dark:text-blue-100">热词配置规则：</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshEngineStatus}
                className="text-xs h-6 px-2"
              >
                刷新引擎状态
              </Button>
            </div>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside ml-2">
              <li>热词用于提高特定词汇的识别准确率，适用于专业术语、人名、地名等</li>
              <li>单个热词长度不超过10个字符</li>
              <li>只支持中文、英文、数字，不支持标点符号和特殊字符</li>
              <li>热词列表最多支持128个热词</li>
              <li>权重范围1-100，数值越高优先级越高，建议使用5-20</li>
              <li>过高的权重可能影响整体识别效果，请合理设置</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 权重100特殊功能说明 */}
      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start space-x-2">
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">权重100特殊功能：</p>
            <ul className="text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside ml-2">
              <li>权重设置为100时，启用<strong>热词增强同音替换功能</strong></li>
              <li>支持引擎：8k_zh、16k_zh、8k_zh_large、16k_zh_large</li>
              <li>功能说明：与热词同拼音的词汇会被强制替换为热词</li>
              <li>示例：热词"蜜制|100"会将同音的"秘制"替换为"蜜制"</li>
              <li><strong>建议仅将重要且必须生效的热词设置为100</strong></li>
              <li><strong>过多权重100热词将影响整体字准率</strong></li>
            </ul>
            {weight100Count > 0 && (
              <p className="mt-2 font-medium text-amber-900 dark:text-amber-100">
                当前权重100热词数量：{weight100Count} 个
                {weight100Count > 5 && <span className="text-red-600 dark:text-red-400"> (建议减少)</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 引擎兼容性警告 */}
      {!isHotwordSupported(currentEngine) && (
        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-red-900 dark:text-red-100">引擎兼容性警告</p>
              <div className="text-red-800 dark:text-red-200">
                <p className="mb-2">
                  当前识别引擎 <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">{currentEngine}</code> 不支持热词功能！
                </p>
                <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md p-2 mb-2">
                  <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                    ℹ️ <strong>自动处理</strong>：系统会自动跳过热词功能，语音识别仍可正常工作
                  </p>
                </div>
                <p className="mb-2">
                  <strong>完整解决方案：</strong>
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>前往"识别设置"页面，将引擎类型更改为中文引擎（如：16k_zh、8k_zh等）</li>
                  <li>或者清空当前热词设置，继续使用当前引擎</li>
                </ul>
                <p className="mt-2 text-xs">
                  支持热词的引擎：8k_zh、16k_zh、8k_zh_large、16k_zh_large、16k_zh_dialect、16k_ca
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 热词功能可用提示 */}
      {isHotwordSupported(currentEngine) && hotwords.length === 0 && (
        <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800 dark:text-green-200">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">热词功能已就绪</p>
              <p>
                当前引擎 <code className="bg-green-100 dark:bg-green-900/50 px-1 rounded">{currentEngine}</code> 支持热词功能，
                您可以添加专业术语、人名、地名等提高识别准确率。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 添加热词 */}
      <div className="space-y-4 p-4 border rounded-lg">
        <Label className="text-base font-medium">添加热词</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="new-word">热词</Label>
            <input
              id="new-word"
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder={isHotwordSupported(currentEngine) ? "输入热词（1-10个字符）" : "当前引擎不支持热词功能"}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={10}
              disabled={!isHotwordSupported(currentEngine)}
              onKeyPress={(e) => e.key === 'Enter' && isHotwordSupported(currentEngine) && addHotword()}
            />
          </div>
          <div>
            <Label htmlFor="new-weight">
              权重 ({newWeight})
              {newWeight === 100 && <span className="text-amber-600 dark:text-amber-400 ml-1">⚡</span>}
            </Label>
            <div className="mt-1 space-y-2">
              <input
                id="new-weight"
                type="range"
                min="1"
                max="100"
                value={newWeight}
                onChange={(e) => setNewWeight(parseInt(e.target.value))}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isHotwordSupported(currentEngine)}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1</span>
                <span className="text-amber-600">100⚡</span>
              </div>
              <Button 
                onClick={addHotword} 
                className="w-full" 
                disabled={!isHotwordSupported(currentEngine) || !newWord.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isHotwordSupported(currentEngine) ? '添加' : '引擎不支持'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 热词列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            已配置热词 ({hotwords.length}/128)
            {weight100Count > 0 && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">
                ⚡{weight100Count}
              </span>
            )}
          </Label>
          {hotwords.length > 0 && (
            <Button onClick={saveHotwordConfig} variant="outline" size="sm">
              保存配置
            </Button>
          )}
        </div>

        {hotwords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无热词配置，请添加热词以提高识别准确率
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {hotwords.map((hotword, index) => (
              <div key={index} className={`flex items-center justify-between p-3 border rounded-lg ${
                hotword.weight === 100 
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' 
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}>
                <div className="flex-1 flex items-center">
                  <span className="font-medium">{hotword.word}</span>
                  {hotword.weight === 100 && (
                    <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 ml-2" />
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 min-w-[140px]">
                    <Label className="text-sm">权重:</Label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={hotword.weight}
                      onChange={(e) => updateWeight(index, parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className={`text-sm font-mono w-8 text-center ${
                      hotword.weight === 100 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''
                    }`}>
                      {hotword.weight}
                    </span>
                  </div>
                  <Button
                    onClick={() => removeHotword(index)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 使用提示 */}
      <div className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
        <p className="font-medium mb-2">使用建议：</p>
        <ul className="space-y-1 list-disc list-inside ml-2">
          <li>为重要的专业术语、人名、地名设置热词</li>
          <li>常用词汇建议权重5-20，重要术语可设置30-50</li>
          <li>权重100启用同音替换，仅用于必须生效的核心热词</li>
          <li>避免设置过多高权重热词，以免影响整体识别效果</li>
          <li>定期清理不常用的热词以保持最佳性能</li>
          <li>权重100功能仅在中文引擎（8k_zh、16k_zh等）中有效</li>
        </ul>
      </div>
    </CardContent>
  );
};

export default Hotwords; 