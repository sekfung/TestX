import { createFileRoute } from '@tanstack/react-router'
import MessageTestRecords from '@/features/message-test/records'

export const Route = createFileRoute('/_authenticated/message-test/records')({  
  component: MessageTestRecords,
})