import { NextRequest, NextResponse } from "next/server"
import { globalRateLimiter } from "@/app/api/search-prices/rate-limiter"

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
  isActiveSearch?: boolean // Markiert aktive Suchen
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

    const queueStatus = globalRateLimiter.getQueueStatus(sessionId)

    // Berechne Anzahl aktiver Suchanfragen (nicht abgeschlossene Sessions)
    const activeSearchCount = Array.from(progressStorage.values()).filter(
      session => !session.isComplete && (Date.now() - session.timestamp) < 30000 // Aktiv in letzten 30 Sekunden
    ).length

    // Berechne geschätzte verbleibende Zeit mit realistischer Logik
    let estimatedTimeRemaining = 0
    if (!progressData.isComplete) {
      const remainingDays = Math.max(0, progressData.totalDays - progressData.currentDay)
      const uncachedDays = progressData.uncachedDays || remainingDays
      
      if (uncachedDays > 0) {
        // Basis: Durchschnittliche API-Zeit pro Request (realistischer: 1-2 Sekunden)
        const avgApiTime = Math.min((progressData.averageUncachedResponseTime || 1500) / 1000, 3) // Max 3s pro Request
        const baseTime = uncachedDays * avgApiTime
        
        // Rate Limiting: Konservativ 1.2 Sekunden zwischen API-Calls
        const rateLimitTime = uncachedDays * 1.2
        
        // Round-Robin Faktor: Moderater bei mehreren Nutzern
        const totalUsers = Math.max(1, activeSearchCount)
        const roundRobinFactor = totalUsers > 1 ? Math.min(1 + (totalUsers - 1) * 0.15, 1.5) : 1.0 // Maximal 50% länger
        
        // Berücksichtige parallele Verarbeitung (bis zu 3 concurrent requests)
        const concurrentRequests = Math.min(3, totalUsers)
        const parallelismBonus = concurrentRequests > 1 ? Math.max(0.6, 1 - (concurrentRequests - 1) * 0.2) : 1.0 // Bis zu 40% schneller
        
        // Finale ETA = (Basis + Rate Limit) * Round-Robin Faktor * Parallelismus Bonus
        estimatedTimeRemaining = Math.round(
          (baseTime + rateLimitTime) * roundRobinFactor * parallelismBonus
        )
        
        // Realistische Grenzen: 1 Sekunde bis 2 Minuten
        estimatedTimeRemaining = Math.min(Math.max(estimatedTimeRemaining, 1), 120)
        
        console.log(`📊 ETA for ${sessionId}: ${uncachedDays} uncached days, ${totalUsers} users, ${Math.round(avgApiTime)}s avg → ${estimatedTimeRemaining}s`)
      } else if (remainingDays > 0) {
        // Nur gecachte Tage verbleibend - sehr schnell
        estimatedTimeRemaining = Math.min(remainingDays * 0.2, 5)
      }
    }

    return NextResponse.json({
      currentDay: progressData.currentDay,
      totalDays: progressData.totalDays,
      currentDate: progressData.currentDate,
      isComplete: progressData.isComplete,
      estimatedTimeRemaining,
      queueSize: progressData.queueSize || 0,
      activeRequests: progressData.activeRequests || 0,
      // Verwende tatsächlich aktive Suchanfragen statt Queue-Status
      totalUsers: activeSearchCount
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