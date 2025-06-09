import { createFileRoute } from '@tanstack/react-router'
import Variables from '@/features/settings/variables'

export const Route = createFileRoute('/_authenticated/settings/variables')({
  component: Variables,
}) 