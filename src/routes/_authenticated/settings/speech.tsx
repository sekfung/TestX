import { createFileRoute } from '@tanstack/react-router'
import SettingsSpeech from '@/features/settings/speech'

export const Route = createFileRoute('/_authenticated/settings/speech')({
  component: SettingsSpeech,
}) 