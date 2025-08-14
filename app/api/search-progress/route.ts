import { NextRequest, NextResponse } from "next/server"

// In-Memory Storage für Progress-Daten
const progressStorage = new Map<string, {
  currentDay: number
  totalDays: number
  currentDate: string
  isComplete: boolean
  uncachedDays?: number
  cachedDays?: number
  averageUncachedResponseTime?: number
  averageCachedResponseTime?: number
  queueSize?: number
  activeRequests?: number
  timestamp: number
}>()

// GET - Progress-Daten abrufen
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const progressData = progressStorage.get(sessionId)
    
    if (!progressData) {
      // Default-Werte wenn noch keine Daten vorhanden
      return NextResponse.json({
        currentDay: 0,
        totalDays: 0,
        isComplete: false,
        estimatedTimeRemaining: 0,
        currentDate: "",
        queueSize: 0,
        activeRequests: 0
      })
    }

    // Berechne geschätzte verbleibende Zeit
    let estimatedTimeRemaining = 0
    if (!progressData.isComplete && progressData.uncachedDays && progressData.averageUncachedResponseTime) {
      // Grobe Schätzung: verbleibende ungecachte Tage * durchschnittliche API-Zeit + Rate Limiting
      const baseTime = progressData.uncachedDays * (progressData.averageUncachedResponseTime / 1000)
      const rateLimitingTime = progressData.uncachedDays * 1 // 1 Sekunde pro API-Call wegen Rate Limiting
      estimatedTimeRemaining = Math.round(baseTime + rateLimitingTime)
    }

    return NextResponse.json({
      currentDay: progressData.currentDay,
      totalDays: progressData.totalDays,
      currentDate: progressData.currentDate,
      isComplete: progressData.isComplete,
      estimatedTimeRemaining,
      queueSize: progressData.queueSize || 0,
      activeRequests: progressData.activeRequests || 0
    })
  } catch (error) {
    console.error("Error getting progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Progress-Daten speichern
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { sessionId } = data
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    // Speichere Progress-Daten
    progressStorage.set(sessionId, {
      ...data,
      timestamp: Date.now()
    })

    console.log(`📊 Progress update for session ${sessionId}: Day ${data.currentDay}/${data.totalDays}, Queue: ${data.queueSize || 0}, Active: ${data.activeRequests || 0}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Cleanup alte Progress-Daten (älter als 1 Stunde)
setInterval(() => {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  
  for (const [sessionId, data] of progressStorage.entries()) {
    if (now - data.timestamp > oneHour) {
      progressStorage.delete(sessionId)
      console.log(`🧹 Cleaned up old progress data for session ${sessionId}`)
    }
  }
}, 5 * 60 * 1000) // Cleanup alle 5 Minuten