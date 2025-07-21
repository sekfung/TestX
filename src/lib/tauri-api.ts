import { invoke } from '@tauri-apps/api/core'

// 定时录音任务相关类型
export interface CreateTimedRecordingTaskParams {
  testId: string;
  scheduledTime: string;
  iotTopic: string;
  iotQosLevel: number;
  iotPayload: string;
  iotProductKey: string;
  iotDeviceName: string;
  expectedText: string;
  pythonCode?: string;
};

// IoT 消息测试相关 API
export const sendIoTMessage = async (
  topic: string, 
  qosLevel: number, 
  payload: string, 
  productKey: string, 
  deviceName: string, 
  mode?: string, 
  pythonCode?: string
): Promise<string> => {
  console.log('📡 sendIoTMessage 函数调用', {
    topic,
    qosLevel,
    payload,
    productKey,
    deviceName,
    mode,
    hasPythonCode: !!pythonCode
  })
  
  // 参数验证
  const missingParams = []
  if (!topic) missingParams.push('topic')
  if (qosLevel === undefined || qosLevel === null) missingParams.push('qosLevel')
  if (!payload) missingParams.push('payload')
  if (!productKey) missingParams.push('productKey')
  if (!deviceName) missingParams.push('deviceName')
  
  if (missingParams.length > 0) {
    console.error('❌ sendIoTMessage 缺少必要参数:', missingParams)
    throw new Error(`缺少必要参数: ${missingParams.join(', ')}`)
  }
  
  const invokeParams = {
    topic,
    qosLevel: qosLevel,
    payload,
    productKey: productKey,
    deviceName: deviceName,
    mode,
    pythonCode: pythonCode
  }
  
  console.log('📤 调用 send_iot_message，参数:', invokeParams)
  
  try {
    const result = await invoke('send_iot_message', invokeParams)
    console.log('✅ send_iot_message 调用成功:', result)
    return result as string
  } catch (error) {
    console.error('❌ send_iot_message 调用失败:', error)
    console.error('失败时的参数:', invokeParams)
    throw new Error(`发送IoT消息失败: ${error}`)
  }
}

export const sendIoTMessageWithPrecomputedParams = async (
  topic: string, 
  qosLevel: number, 
  payload: string, 
  productKey: string, 
  deviceName: string, 
  mode?: string, 
  pythonCode?: string,
  usePrecomputed?: boolean
): Promise<string> => {
  try {
    return await invoke('send_iot_message_with_precomputed_params', { 
      topic, 
      qosLevel, 
      payload, 
      productKey, 
      deviceName, 
      mode, 
      pythonCode,
      usePrecomputed
    });
  } catch (error) {
    throw new Error(`发送IoT消息失败: ${error}`);
  }
};

export const getMessageTests = async (): Promise<MessageTest[]> => {
  try {
    const tests = await invoke('get_message_tests');
    return Array.isArray(tests) ? tests : [];
  } catch (error) {
    console.error('获取消息测试记录失败:', error);
    return [];
  }
};

export const getMessageTestById = async (id: string): Promise<MessageTest | null> => {
  try {
    const test = await invoke<MessageTest | null>('get_message_test_by_id', { id });
    return test;
  } catch (error) {
    console.error('获取消息测试记录失败:', error);
    return null;
  }
};

export const retestMessage = async (id: string): Promise<string> => {
  try {
    return await invoke('retest_message', { id });
  } catch (error) {
    throw new Error(`重新测试失败: ${error}`);
  }
};

export const sendIoTMessageFromPython = async (
  pythonCode: string
): Promise<string> => {
  try {
    return await invoke('send_iot_message_from_python', { 
      pythonCode
    });
  } catch (error) {
    throw new Error(`通过Python发送IoT消息失败: ${error}`);
  }
};

export const deleteMessageTest = async (id: string): Promise<void> => {
  try {
    await invoke('delete_message_test', { id });
  } catch (error) {
    throw new Error(`删除消息测试记录失败: ${error}`);
  }
};

export const deleteMessageTestsBatch = async (ids: string[]): Promise<void> => {
  try {
    await invoke('delete_message_tests_batch', { ids });
  } catch (error) {
    throw new Error(`批量删除消息测试记录失败: ${error}`);
  }
};

export const truncateMessageTests = async (): Promise<number> => {
  return await invoke('truncate_message_tests');
};

// 数据管理相关 API
export const exportData = async (exportPath: string): Promise<string> => {
  try {
    return await invoke('export_data', { exportPath });
  } catch (error) {
    throw new Error(`导出数据失败: ${error}`);
  }
};

export const importData = async (importPath: string): Promise<string> => {
  try {
    return await invoke('import_data', { importPath });
  } catch (error) {
    throw new Error(`导入数据失败: ${error}`);
  }
};

export const getDataStats = async (): Promise<string> => {
  try {
    return await invoke('get_data_stats');
  } catch (error) {
    throw new Error(`获取数据统计失败: ${error}`);
  }
};

export interface MessageTest {
  id: string;
  topic: string;
  qos_level: number;
  payload: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  response?: string;
  created_at: string;
  product_key?: string;
  device_name?: string;
  mode: string; // 'form' | 'code'
  python_code?: string;
  notes?: string;
}

// Accuracy Test 相关 API
export interface AccuracyTest {
  id: string;
  expected_text: string;
  recognized_text?: string;
  similarity?: number;
  result: 'pending' | 'passed' | 'failed';
  created_at: string;
  completed_at?: string;
  audio_file_path?: string;
  python_code?: string;
  mode: 'form' | 'code';
  error_message?: string;
  notes?: string;
  audio_data?: string; // Base64编码的音频数据
  audio_duration?: number; // 音频时长（毫秒）
  test_mode: string; // manual, loop, timed
  loop_count?: number; // 循环次数（循环模式使用）
  scheduled_time?: string; // 定时录音时间（定时模式使用）
  current_loop: number; // 当前循环次数
  auto_executed: boolean; // 是否自动执行代码
}

export interface AccuracyTestRequest {
  expected_text: string;
  mode: string; // form, code
  python_code?: string;
  notes?: string;
  test_mode: string; // manual, loop, timed
  loop_count?: number; // 循环次数（循环模式使用）
  scheduled_time?: string; // 定时录音时间（定时模式使用）
}

export interface SpeechRecognitionResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
}

export const createAccuracyTest = async (request: AccuracyTestRequest): Promise<AccuracyTest> => {
  try {
    return await invoke('create_accuracy_test', { request });
  } catch (error) {
    throw new Error(`创建准确性测试失败: ${error}`);
  }
};

export const getAccuracyTests = async (): Promise<AccuracyTest[]> => {
  try {
    const tests = await invoke('get_accuracy_tests');
    return Array.isArray(tests) ? tests : [];
  } catch (error) {
    console.error('获取准确性测试记录失败:', error);
    return [];
  }
};

export const deleteAccuracyTest = async (id: string): Promise<void> => {
  try {
    await invoke('delete_accuracy_test', { id });
  } catch (error) {
    throw new Error(`删除准确性测试记录失败: ${error}`);
  }
};

export const deleteAccuracyTestsBatch = async (ids: string[]): Promise<void> => {
  console.log('🗑️ 批量删除准确性测试:', ids);
  await invoke('delete_accuracy_tests_batch', { ids });
};

export const truncateAccuracyTests = async (): Promise<number> => {
  return await invoke('truncate_accuracy_tests');
};

export const completeAccuracyTest = async (testId: string, audioBase64: string): Promise<AccuracyTest> => {
  try {
    return await invoke('complete_accuracy_test', { testId, audioBase64 });
  } catch (error) {
    throw new Error(`完成准确性测试失败: ${error}`);
  }
};

export const executeAccuracyTestWithMessage = async (testId: string, audioBase64: string): Promise<AccuracyTest> => {
  try {
    return await invoke('execute_accuracy_test_with_message', { testId, audioBase64 });
  } catch (error) {
    throw new Error(`执行准确性测试失败: ${error}`);
  }
};

export const executeAccuracyTestWithParams = async (
  testId: string, 
  audioBase64: string,
  iotTopic: string,
  iotQosLevel: number,
  iotPayload: string,
  iotProductKey: string,
  iotDeviceName: string,
  expectedText: string
): Promise<AccuracyTest> => {
  try {
    return await invoke('execute_accuracy_test_with_params', { 
      testId, 
      audioBase64,
      iotTopic,
      iotQosLevel,
      iotPayload,
      iotProductKey,
      iotDeviceName,
      expectedText
    });
  } catch (error) {
    throw new Error(`执行准确性测试失败: ${error}`);
  }
};

export const executeAccuracyTestWithParamsPrecomputed = async (
  testId: string,
  audioBase64: string,
  iotTopic: string,
  iotQosLevel: number,
  iotPayload: string,
  iotProductKey: string,
  iotDeviceName: string,
  expectedText: string,
  usePrecomputed?: boolean,
  pythonCode?: string,
  audioDuration?: number
): Promise<AccuracyTest> => {
  console.log('🎯 executeAccuracyTestWithParamsPrecomputed 函数调用', {
    testId,
    audioBase64,
    iotTopic,
    iotQosLevel,
    iotPayload,
    iotProductKey,
    iotDeviceName,
    expectedText,
    usePrecomputed,
    hasPythonCode: !!pythonCode
  })
  
  // 参数验证
  const missingParams = []
  if (!testId) missingParams.push('testId')
  // audioBase64 可以为空字符串，表示后端会先发送IoT消息再通知前端录音
  if (audioBase64 === undefined || audioBase64 === null) missingParams.push('audioBase64')
  if (!iotTopic) missingParams.push('iotTopic')
  if (iotQosLevel === undefined || iotQosLevel === null) missingParams.push('iotQosLevel')
  if (!iotPayload) missingParams.push('iotPayload')
  if (!iotProductKey) missingParams.push('iotProductKey')
  if (!iotDeviceName) missingParams.push('iotDeviceName')
  if (!expectedText) missingParams.push('expectedText')
  
  if (missingParams.length > 0) {
    console.error('❌ executeAccuracyTestWithParamsPrecomputed 缺少必要参数:', missingParams)
    throw new Error(`缺少必要参数: ${missingParams.join(', ')}`)
  }
  
  const invokeParams = {
    testId: testId,
    audioBase64: audioBase64,
    iotTopic: iotTopic,
    iotQosLevel: iotQosLevel,
    iotPayload: iotPayload,
    iotProductKey: iotProductKey,
    iotDeviceName: iotDeviceName,
    expectedText: expectedText,
    usePrecomputed: usePrecomputed,
    pythonCode: pythonCode,
    audioDuration: audioDuration
  }
  
  console.log('📤 调用 execute_accuracy_test_with_params_precomputed，参数:', invokeParams)
  
  try {
    const result = await invoke('execute_accuracy_test_with_params_precomputed', invokeParams)
    console.log('✅ execute_accuracy_test_with_params_precomputed 调用成功:', result)
    return result as AccuracyTest
  } catch (error) {
    console.error('❌ execute_accuracy_test_with_params_precomputed 调用失败:', error)
    console.error('失败时的参数:', invokeParams)
    throw new Error(`执行准确性测试失败: ${error}`)
  }
}

export const executeAccuracyTestPythonCode = async (code: string): Promise<any> => {
  try {
    return await invoke('execute_accuracy_test_python_code', { code });
  } catch (error) {
    throw new Error(`执行Python代码失败: ${error}`);
  }
};

export const performSpeechRecognition = async (audioPath: string): Promise<SpeechRecognitionResult> => {
  try {
    return await invoke('perform_speech_recognition', { audioPath });
  } catch (error) {
    throw new Error(`语音识别失败: ${error}`);
  }
};

export const performSpeechRecognitionFromBase64 = async (audioBase64: string): Promise<SpeechRecognitionResult> => {
  try {
    return await invoke('perform_speech_recognition_from_base64', { audioBase64 });
  } catch (error) {
    throw new Error(`从Base64音频进行语音识别失败: ${error}`);
  }
};

export const getAccuracyTestPythonTemplate = async (): Promise<string> => {
  try {
    return await invoke('get_accuracy_test_python_template')
  } catch (error) {
    throw new Error(`获取Python模板失败: ${error}`)
  }
}

// 串口相关 API
export const scanSerialPorts = async (): Promise<string[]> => {
  return await invoke('scan_serial_ports');
};

export const connectSerialPort = async (port: string, baudRate: number): Promise<void> => {
  return await invoke('connect_serial_port', { port, baudRate });
};

export const disconnectSerialPort = async (port: string): Promise<void> => {
  return await invoke('disconnect_serial_port', { port });
};

export const isSerialPortConnected = async (port: string): Promise<boolean> => {
  return await invoke('is_serial_port_connected', { port });
};

// 创建定时录音任务
export const createTimedRecordingTask = async (params: CreateTimedRecordingTaskParams): Promise<void> => {
  console.log('📅 [TimedRecording] createTimedRecordingTask 函数调用开始', {
    timestamp: new Date().toISOString(),
    params: params
  })
  
  // 参数验证
  const missingParams = []
  if (!params.testId) missingParams.push('testId')
  if (!params.scheduledTime) missingParams.push('scheduledTime')
  if (!params.iotTopic) missingParams.push('iotTopic')
  if (params.iotQosLevel === undefined || params.iotQosLevel === null) missingParams.push('iotQosLevel')
  if (!params.iotPayload) missingParams.push('iotPayload')
  if (!params.iotProductKey) missingParams.push('iotProductKey')
  if (!params.iotDeviceName) missingParams.push('iotDeviceName')
  if (!params.expectedText) missingParams.push('expectedText')
  
  if (missingParams.length > 0) {
    console.error('❌ [TimedRecording] createTimedRecordingTask 缺少必要参数:', missingParams)
    throw new Error(`缺少必要参数: ${missingParams.join(', ')}`)
  }
  
  console.log('✅ [TimedRecording] 参数验证通过')
  
  const invokeParams = {
    testid: params.testId,
    scheduledtime: params.scheduledTime,
    iottopic: params.iotTopic,
    iotqoslevel: params.iotQosLevel,
    iotpayload: params.iotPayload,
    iotproductkey: params.iotProductKey,
    iotdevicename: params.iotDeviceName,
    expectedtext: params.expectedText,
    pythoncode: params.pythonCode
  }
  
  console.log('📤 [TimedRecording] 准备调用后端 create_timed_recording_task')
  console.log('📋 [TimedRecording] 发送给后端的参数:', {
    testid: invokeParams.testid,
    scheduledtime: invokeParams.scheduledtime,
    iottopic: invokeParams.iottopic,
    iotqoslevel: invokeParams.iotqoslevel,
    iotpayload: invokeParams.iotpayload,
    iotproductkey: invokeParams.iotproductkey,
    iotdevicename: invokeParams.iotdevicename,
    expectedtext: invokeParams.expectedtext,
    pythoncode: invokeParams.pythoncode
  })
  
  try {
    console.log('🚀 [TimedRecording] 开始调用后端函数...')
    await invoke('create_timed_recording_task', invokeParams)
    console.log('✅ [TimedRecording] create_timed_recording_task 调用成功，定时录音任务已创建')
  } catch (error) {
    console.error('❌ [TimedRecording] create_timed_recording_task 调用失败:', {
      error: error,
      errorMessage: error instanceof Error ? error.message : String(error),
      invokeParams: invokeParams
    })
    throw error
  }
};

// 代码模板相关类型定义
export interface CodeTemplate {
  id: number;
  name: string;
  description?: string;
  code_content: string;
  language: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodeTemplateTag {
  id: number;
  name: string;
  color?: string;
  created_at: string;
}

export interface CodeTemplateWithTags {
  template: CodeTemplate;
  tags: CodeTemplateTag[];
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  code_content: string;
  language: string;
  tag_ids: number[];
}

export interface SearchTemplateRequest {
  query?: string;
  language?: string;
  tag_names: string[];
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

// 代码模板相关 API
export const saveCodeTemplate = async (request: CreateTemplateRequest): Promise<number> => {
  try {
    return await invoke('save_code_template', { request });
  } catch (error) {
    throw new Error(`保存代码模板失败: ${error}`);
  }
};

export const getCodeTemplates = async (language?: string): Promise<CodeTemplateWithTags[]> => {
  try {
    return await invoke('get_code_templates', { language });
  } catch (error) {
    throw new Error(`获取代码模板失败: ${error}`);
  }
};

export const searchCodeTemplates = async (request: SearchTemplateRequest): Promise<CodeTemplateWithTags[]> => {
  try {
    return await invoke('search_code_templates', {
      query: request.query,
      language: request.language,
      tagNames: request.tag_names
    });
  } catch (error) {
    throw new Error(`搜索代码模板失败: ${error}`);
  }
};

export const deleteCodeTemplate = async (id: number): Promise<void> => {
  try {
    await invoke('delete_code_template', { id });
  } catch (error) {
    throw new Error(`删除代码模板失败: ${error}`);
  }
};

export const createCodeTemplateTag = async (request: CreateTagRequest): Promise<number> => {
  try {
    return await invoke('create_code_template_tag', { request });
  } catch (error) {
    throw new Error(`创建标签失败: ${error}`);
  }
};

export const getAllCodeTemplateTags = async (): Promise<CodeTemplateTag[]> => {
  try {
    return await invoke('get_all_code_template_tags');
  } catch (error) {
    throw new Error(`获取标签失败: ${error}`);
  }
};

export const searchCodeTemplateTags = async (query: string): Promise<CodeTemplateTag[]> => {
  try {
    return await invoke('search_code_template_tags', { query });
  } catch (error) {
    throw new Error(`搜索标签失败: ${error}`);
  }
};

export const updateCodeTemplate = async (request: {
  id: number;
  name: string;
  description?: string;
  code_content: string;
  language: string;
  tag_ids: number[];
}): Promise<void> => {
  try {
    await invoke('update_code_template', { request });
  } catch (error) {
    throw new Error(`更新代码模板失败: ${error}`);
  }
};

export const updateCodeTemplateTag = async (request: {
  id: number;
  name: string;
  color: string;
}): Promise<void> => {
  try {
    await invoke('update_code_template_tag', { request });
  } catch (error) {
    throw new Error(`更新标签失败: ${error}`);
  }
};

export const deleteCodeTemplateTag = async (id: number): Promise<void> => {
  try {
    await invoke('delete_code_template_tag', { id });
  } catch (error) {
    throw new Error(`删除标签失败: ${error}`);
  }
};