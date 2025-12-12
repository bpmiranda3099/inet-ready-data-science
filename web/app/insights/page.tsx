"use client"

import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const historicalData = [
  { name: "Thu", current: 98, average: 97 },
  { name: "Fri", current: 102, average: 99 },
  { name: "Sat", current: 105, average: 100 },
  { name: "Sun", current: 103, average: 99 },
  { name: "Mon", current: 100, average: 98 },
  { name: "Tue", current: 95, average: 96 },
  { name: "Wed", current: 108, average: 97 },
]

const demographicData = [
  { name: "Elderly", low: 18, medium: 42, high: 78 },
  { name: "Children", low: 12, medium: 38, high: 20 },
  { name: "Outdoor Workers", low: 20, medium: 60, high: 98 },
  { name: "Health Compromised", low: 38, medium: 58, high: 62 },
]

export default function InsightsReport() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="text-2xl">☀️</div>
        <nav className="flex gap-8">
          <button className="hover:opacity-80">Features</button>
          <button className="hover:opacity-80">About</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-8 bg-gray-50">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-base hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300 flex flex-col justify-center">
            <p className="text-gray-700 font-medium mb-2">Weekly Avg Heat Index</p>
            <div className="text-3xl font-bold text-gray-900">
              50°C <span className="text-lg text-red-500 ml-2">📈 +3°C Trend</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300 flex flex-col justify-center">
            <p className="text-gray-700 font-medium mb-2">Total High Risk Hours</p>
            <div className="text-3xl font-bold text-gray-900">⏰ 32 hrs</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300 flex flex-col justify-center">
            <p className="text-gray-700 font-medium mb-2">Vulnerable Pop. Affected</p>
            <div className="text-3xl font-bold text-gray-900">👥 15,000+</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300 flex flex-col justify-center">
            <p className="text-gray-700 font-medium mb-2">Cooling Center Capacity</p>
            <div className="text-3xl font-bold text-gray-900">🏢 85% Full</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Historical Comparison */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-4">Historical Comparison (Last 7 Days)</h3>
            <div className="mb-4 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-300 rounded"></div>
                <span className="text-sm text-gray-700">Current Heat Index</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-400 rounded"></div>
                <span className="text-sm text-gray-700">5-year Average</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#fca5a5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Area type="monotone" dataKey="current" stroke="#dc2626" fill="url(#colorCurrent)" />
                <Area type="monotone" dataKey="average" stroke="#9ca3af" fill="url(#colorAverage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Demographic Impact */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-4">Demographic Impact Analysis</h3>
            <div className="mb-4 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-600 rounded"></div>
                <span className="text-sm text-gray-700">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-400 rounded"></div>
                <span className="text-sm text-gray-700">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 rounded"></div>
                <span className="text-sm text-gray-700">High</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={demographicData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Bar dataKey="low" stackId="a" fill="#16a34a" />
                <Bar dataKey="medium" stackId="a" fill="#fb923c" />
                <Bar dataKey="high" stackId="a" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Safety Recommendations */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-4">Safety Recommendations</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-gray-700">
                <span className="text-lg">•</span>
                <span>Extend cooling center hours in northern district</span>
              </li>
              <li className="flex items-start gap-3 text-gray-700">
                <span className="text-lg">•</span>
                <span>If possible, just stay at home and rest</span>
              </li>
              <li className="flex items-start gap-3 text-gray-700">
                <span className="text-lg">•</span>
                <span>Increase hydration station supplies</span>
              </li>
            </ul>
          </div>

          {/* Data Export */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300">
            <h3 className="font-bold text-gray-800 mb-4">Data Export</h3>
            <div className="flex gap-4">
              <button className="flex-1 px-6 py-3 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors">
                Download PDF Report
              </button>
              <button className="flex-1 px-6 py-3 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors">
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Download Full Report Link */}
        <div className="text-right mt-8">
          <a href="#" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
            Download Full Insights Reports
          </a>
        </div>
      </main>
    </div>
  )
}
