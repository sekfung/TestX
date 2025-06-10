import { 
  getMessageTests as apiGetMessageTests, 
  sendIoTMessage, 
  sendIoTMessageWithPrecomputedParams,
  deleteMessageTest as apiDeleteMessageTest,
  deleteMessageTestsBatch as apiDeleteMessageTestsBatch,
  truncateMessageTests as apiTruncateMessageTests, 
  getMessageTestById as apiGetMessageTestById,
  retestMessage as apiRetestMessage,
  sendIoTMessageFromPython as apiSendIoTMessageFromPython,
  type MessageTest as ApiMessageTest 
} from '@/lib/tauri-api';

export interface MessageTest {
  id: string
  topic: string
  qosLevel: 0 | 1 | 2
  payload: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  response?: string
  createdAt: string
  productKey?: string
  deviceName?: string
  mode: 'form' | 'code'
  pythonCode?: string
  notes?: string
}

// 转换后端数据格式到前端格式
function transformMessageTest(apiTest: ApiMessageTest): MessageTest {
  return {
    id: apiTest.id,
    topic: apiTest.topic,
    qosLevel: apiTest.qos_level as 0 | 1 | 2,
    payload: apiTest.payload,
    status: apiTest.status,
    sentAt: apiTest.sent_at,
    response: apiTest.response,
    createdAt: apiTest.created_at,
    productKey: apiTest.product_key,
    deviceName: apiTest.device_name,
    mode: (apiTest.mode as 'form' | 'code') || 'form',
    pythonCode: apiTest.python_code,
    notes: apiTest.notes,
  };
}

// API调用函数
export const getMessageTests = async (): Promise<MessageTest[]> => {
  const apiTests = await apiGetMessageTests();
  return apiTests.map(transformMessageTest);
};

export const getMessageTestById = async (id: string): Promise<MessageTest | null> => {
  const apiTest = await apiGetMessageTestById(id);
  return apiTest ? transformMessageTest(apiTest) : null;
};

export const sendMessage = async (
  topic: string, 
  qosLevel: number, 
  payload: string, 
  productKey: string, 
  deviceName: string, 
  mode?: string, 
  pythonCode?: string
): Promise<string> => {
  return await sendIoTMessage(topic, qosLevel, payload, productKey, deviceName, mode, pythonCode);
};

export const sendMessageWithPrecomputedParams = async (
  topic: string, 
  qosLevel: number, 
  payload: string, 
  productKey: string, 
  deviceName: string, 
  mode?: string, 
  pythonCode?: string,
  usePrecomputed?: boolean
): Promise<string> => {
  return await sendIoTMessageWithPrecomputedParams(
    topic, 
    qosLevel, 
    payload, 
    productKey, 
    deviceName, 
    mode, 
    pythonCode,
    usePrecomputed
  );
};

export const retestMessage = async (id: string): Promise<string> => {
  return await apiRetestMessage(id);
};

export const sendMessageFromPython = async (
  pythonCode: string
): Promise<string> => {
  return await apiSendIoTMessageFromPython(pythonCode);
};

export const deleteMessageTest = async (id: string): Promise<void> => {
  return await apiDeleteMessageTest(id);
};

export const deleteMessageTestsBatch = async (ids: string[]): Promise<void> => {
  return await apiDeleteMessageTestsBatch(ids);
};

export const truncateMessageTests = async (): Promise<number> => {
  return await apiTruncateMessageTests();
};

// 空数组，数据将从后端API获取
export const messageTests: MessageTest[] = []