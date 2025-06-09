import { createFileRoute } from '@tanstack/react-router'
import AccuracyTestNew from '@/features/cloud-speaker/accuracy-test/new'

export const Route = createFileRoute('/_authenticated/cloud-speaker/accuracy-test/new')({  
  component: AccuracyTestNew,
})