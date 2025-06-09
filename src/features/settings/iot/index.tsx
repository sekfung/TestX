import ContentSection from '../components/content-section';
import { IoTForm } from './iot-form';

export default function SettingsIoT() {
  return (
    <ContentSection
      title="IoT 平台配置"
      desc="配置 IoT 平台的连接参数和认证信息。"
    >
      <IoTForm />
    </ContentSection>
  );
} 