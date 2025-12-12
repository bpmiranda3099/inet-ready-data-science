import { Suspense } from "react"
import InsightsReport from "./insights-report"

function InsightsFallback() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
      <span className="text-sm uppercase tracking-[0.3em]">INET-READY</span>
      <p className="mt-3 text-lg font-semibold">Loading insights...</p>
    </div>
  )
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsFallback />}>
      <InsightsReport />
    </Suspense>
  )
}
