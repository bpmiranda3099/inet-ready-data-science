"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

const chartData = [
  { name: "Thu", value: 98 },
  { name: "Fri", value: 102 },
  { name: "Sat", value: 105 },
  { name: "Sun", value: 103 },
  { name: "Mon", value: 100 },
  { name: "Tue", value: 95 },
  { name: "Wed", value: 108 },
]

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>("")
  const [currentDate, setCurrentDate] = useState<string>("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      const dateString = now.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "2-digit",
      })
      setCurrentTime(timeString)
      setCurrentDate(dateString)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="text-2xl">☀️</div>
        <nav className="flex gap-8">
          <button className="hover:opacity-80">Features</button>
          <button className="hover:opacity-80">About</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Left Column - Map and Chart */}
          <div className="col-span-2 space-y-6">
            {/* Heat Map */}
            <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-300">
              <div className="flex items-center gap-2 mb-4">
                <label className="text-lg font-bold text-gray-800">Municipality</label>
                <select className="ml-auto px-4 py-2 border-2 border-gray-300 rounded-lg bg-white cursor-pointer font-medium">
                  <option>Kawit</option>
                  <option>Rosario</option>
                  <option>General Trias</option>
                  <option>Dasmariñas/Tanza</option>
                  <option>Silang/Amadeo</option>
                  <option>Noveleta</option>
                  <option>Bacoor</option>
                  <option>Cavite City</option>
                  <option>Naic/Magallanes</option>
                </select>
              </div>
              {/* Cavite Map */}
              <div className="w-full h-80 rounded-2xl overflow-hidden border-2 border-gray-300">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d123456.78901234!2d120.88!3d14.35!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d69c3759c7b1%3A0xa99b77f0e29a4b0!2sCavite%2C%20Philippines!5e0!3m2!1sen!2sph!4v1234567890"
                ></iframe>
              </div>
            </div>

            {/* 7-Day Chart */}
            <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-600">Temperature Trend</div>
                <span className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold">7-day</span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ff6b35" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" stroke="#999" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#999" domain={[90, 110]} style={{ fontSize: "12px" }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ff6b35"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column - Alert Cards */}
          <div className="space-y-4">
            {/* Time & Date - Full width at top */}
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-300 text-right mb-6">
              <div className="text-4xl font-bold text-gray-900">{currentTime || "Loading..."}</div>
              <div className="text-gray-600 text-sm mt-1">{currentDate || ""}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Risk Level - spans full width */}
              <div className="col-span-2 bg-red-900 text-white rounded-2xl py-5 px-6 shadow-md flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-xs font-semibold opacity-90">Risk Level</p>
                  <p className="text-xl font-bold">DANGER</p>
                </div>
              </div>

              {/* Current Heat Index - left */}
              <div className="bg-red-600 text-white rounded-2xl p-5 shadow-md">
                <p className="text-xs font-semibold opacity-90 mb-2">Current Heat Index</p>
                <div className="text-4xl font-bold mb-2">52°C</div>
                <div className="flex items-center gap-1">
                  <span className="text-xl">☀️</span>
                  <span className="font-bold text-xs">High Risk</span>
                </div>
              </div>

              {/* Peak 24 Hours - right */}
              <div className="bg-pink-600 text-white rounded-2xl p-5 shadow-md">
                <p className="text-xs font-semibold opacity-90 mb-2">Next 24 Hours</p>
                <div className="text-3xl font-bold mb-2">PEAK 52°C</div>
                <div className="flex items-center gap-2 bg-white bg-opacity-25 rounded-full px-3 py-1 w-fit">
                  <span className="text-lg">📈</span>
                  <span className="font-bold text-xs">Extreme Danger</span>
                </div>
              </div>

              {/* Vulnerable Groups - left */}
              <div className="bg-blue-900 text-white rounded-2xl p-5 shadow-md">
                <p className="text-xs font-semibold opacity-90 mb-2">Vulnerable Groups</p>
                <div className="text-2xl font-bold mb-3">HIGH-RISK ALERT</div>
                <div className="flex items-center gap-2 bg-white text-blue-900 rounded-full px-3 py-1 w-fit">
                  <span className="text-sm">👥</span>
                  <span className="font-bold text-xs">Elderly, Pregnant, Outdoor Workers</span>
                </div>
              </div>

              {/* Safety Recommendation - right */}
              <div className="bg-green-600 text-white rounded-2xl p-5 shadow-md">
                <p className="text-xs font-semibold opacity-90 mb-2">Immediate Safety</p>
                <div className="text-2xl font-bold mb-3">STAY INDOORS</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">💧</span>
                  <span className="font-bold">Hydrate & Rest</span>
                </div>
              </div>
            </div>

            {/* View Insights Reports link */}
            <Link
              href="/insights"
              className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-sm text-right block mt-4"
            >
              View Insights Reports
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
