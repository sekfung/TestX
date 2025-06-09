import { createFileRoute } from '@tanstack/react-router'
import AccuracyTestRecords from '@/features/cloud-speaker/accuracy-test/records'

export const Route = createFileRoute('/_authenticated/cloud-speaker/accuracy-test/records')({  
  component: AccuracyTestRecords,
})