import { createFileRoute } from '@tanstack/react-router'
import DataManagement from '@/features/settings/data'

export const Route = createFileRoute('/_authenticated/settings/data')({
  component: () => <DataManagement />,
}) 