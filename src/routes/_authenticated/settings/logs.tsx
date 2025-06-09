import { createFileRoute } from '@tanstack/react-router'
import SettingsLogs from '@/features/settings/logs'

export const Route = createFileRoute('/_authenticated/settings/logs')({
  component: SettingsLogs,
}) 