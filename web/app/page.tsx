"use client"

import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/app-icon.png" alt="INET-READY icon" width={40} height={40} priority className="h-10 w-10" />
          <span className="text-2xl font-semibold">INET-READY</span>
        </div>
        <nav className="flex gap-8">
          <button className="hover:opacity-80">Features</button>
          <button className="hover:opacity-80">About</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-12">
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-green-200 via-cyan-100 to-green-300 rounded-3xl p-12 mb-12 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-5xl font-bold text-white mb-4" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.1)" }}>
              Stay Informed.
            </h1>
            <h2 className="text-5xl font-bold text-white mb-8" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.1)" }}>
              Stay Safe.
            </h2>
            <Link href="/dashboard">
              <button className="bg-orange-400 hover:bg-orange-500 text-white px-8 py-3 rounded-full text-lg font-semibold transition-colors">
                Get Personalized Forecast
              </button>
            </Link>
          </div>

          {/* Background Illustration Elements */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Sun */}
            <div className="absolute top-8 right-12 w-20 h-20 bg-yellow-300 rounded-full opacity-80"></div>

            {/* Buildings */}
            <div className="absolute bottom-0 right-32 w-16 h-24 bg-orange-300 rounded-t-lg opacity-70"></div>
            <div className="absolute bottom-0 right-48 w-20 h-32 bg-orange-300 rounded-t-lg opacity-70"></div>
            <div className="absolute bottom-0 right-8 w-12 h-16 bg-orange-300 rounded-t-lg opacity-70"></div>

            {/* Hills */}
            <svg
              className="absolute bottom-0 left-0 w-full h-32 opacity-50"
              viewBox="0 0 1200 200"
              preserveAspectRatio="none"
            >
              <path d="M 0 100 Q 150 0 300 100 T 600 100 T 900 100 T 1200 100 L 1200 200 L 0 200 Z" fill="#7cb342" />
            </svg>

            {/* Birds */}
            <div className="absolute top-12 right-1/3 text-2xl text-white">
              <span className="material-symbols-rounded" aria-hidden="true">
                flight
              </span>
            </div>
            <div className="absolute top-16 right-2/5 text-2xl text-white">
              <span className="material-symbols-rounded" aria-hidden="true">
                flight
              </span>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-6">
          <div className="border-2 border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-gray-400 transition-colors">
            <span className="material-symbols-rounded text-6xl text-blue-600" aria-hidden="true">
              map
            </span>
            <p className="text-lg font-semibold text-gray-800">Local Trend Data</p>
          </div>
          <div className="border-2 border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-gray-400 transition-colors">
            <span className="material-symbols-rounded text-6xl text-blue-600" aria-hidden="true">
              query_stats
            </span>
            <p className="text-lg font-semibold text-gray-800">7-Day Trend Data</p>
          </div>
          <div className="border-2 border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-gray-400 transition-colors">
            <span className="material-symbols-rounded text-6xl text-blue-600" aria-hidden="true">
              shield_person
            </span>
            <p className="text-lg font-semibold text-gray-800">Health & Safety</p>
          </div>
        </div>
      </main>
    </div>
  )
}
