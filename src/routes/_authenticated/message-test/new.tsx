import { createFileRoute } from '@tanstack/react-router'
import MessageTestNew from '@/features/message-test/new'

export const Route = createFileRoute('/_authenticated/message-test/new')({  
  component: MessageTestNew,
})