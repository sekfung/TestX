import {
  IconBarrierBlock,
  IconBug,
  IconFileText,
  IconHelp,
  IconLayoutDashboard,
  IconLock,
  IconLockAccess,
  IconMicrophone,
  IconPackages,
  IconServerOff,
  IconSettings,
  IconUserOff,
  IconSpeakerphone,
  IconTestPipe,
  IconMessageCircle,
  IconDatabase,
  IconVariable,
  IconRefresh,
} from '@tabler/icons-react'
import { AudioWaveform, Command, GalleryVerticalEnd } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: 'xifeng.liu@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Excelsecu',
      logo: Command,
      plan: '',
    },
   
  ],
  navGroups: [
    {
      title: '通用',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: IconLayoutDashboard,
        },
        {
          title: 'MQTT报文测试',
          icon: IconMessageCircle,
          items: [
            {
              title: '新建测试',
              url: '/message-test/new',
              icon: IconTestPipe,
            },
            {
              title: '测试记录',
              url: '/message-test/records',
              icon: IconFileText,
            },
          ],
        },
        // {
        //   title: '重置设备',
        //   url: '/reset-device',
        //   icon: IconRefresh,
        // },
      ],
    },
    {
      title: '云音箱',
      items: [
        {
          title: '播报准确性测试',
          icon: IconTestPipe,
          items: [
            {
              title: '新建测试',
              url: '/cloud-speaker/accuracy-test/new',
              icon: IconTestPipe,
            },
            {
              title: '测试记录',
              url: '/cloud-speaker/accuracy-test/records',
              icon: IconFileText,
            },
          ],
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          title: '应用设置',
          icon: IconSettings,
          items: [
            {
              title: '变量管理',
              url: '/settings/variables',
              icon: IconVariable,
            },
            {
              title: '语音识别',
              url: '/settings/speech',
              icon: IconMicrophone,
            },
            {
              title: 'IoT 平台',
              url: '/settings/iot',
              icon: IconPackages,
            },
            {
              title: '数据管理',
              url: '/settings/data',
              icon: IconDatabase,
            },
            {
              title: '日志设置',
              url: '/settings/logs',
              icon: IconFileText,
            },
          ],
        },
        {
          title: '帮助中心',
          url: '/help-center',
          icon: IconHelp,
        },
      ],
    },
  ],
}
