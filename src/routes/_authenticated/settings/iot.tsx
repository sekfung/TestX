import { createFileRoute } from '@tanstack/react-router'
import SettingsIoT from '@/features/settings/iot'

export const Route = createFileRoute('/_authenticated/settings/iot')({
  component: SettingsIoT,
}) 