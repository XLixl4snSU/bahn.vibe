import { NextRequest, NextResponse } from "next/server"

// Progress-Tracking Interface
interface SearchProgress {
  sessionId: string
  currentDay: number
  totalDays: number
  isComplete: boolean
  estimatedTimeRemaining: number // in seconds
  currentDate: string
  startTime: number
  lastUpdate: number
  results?: any // Die finalen Suchergebnisse
}

// In-Memory Progress-Cache als Map
const progressCache = new Map<string, any>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400 })
  }

  const existingProgress = progressCache.get(sessionId)

  if (!existingProgress) {
    return new Response(JSON.stringify({ 
      error: 'Session not found',
      sessionId,
      currentDay: 0,
      totalDays: 0,
      isComplete: false,
      estimatedTimeRemaining: 0,
      currentDate: ''
    }), { status: 404 })
  }

  // Startzeit für ETA
  const now = Date.now()
  const startTime = existingProgress.startTime || now

  return new Response(JSON.stringify({ ...existingProgress, startTime }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      currentDay,
      totalDays,
      currentDate,
      isComplete,
      results,
      uncachedDays,
      cachedDays,
      averageUncachedResponseTime,
      averageCachedResponseTime,
    } = body

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400 })
    }

    const now = Date.now()
    const existingProgress = progressCache.get(sessionId)

    let estimatedTimeRemaining = 0
    const startTime = existingProgress?.startTime || now

    // Neue, präzisere ETA-Berechnung
    if (
      typeof uncachedDays === "number" &&
      typeof cachedDays === "number" &&
      typeof averageUncachedResponseTime === "number" &&
      typeof averageCachedResponseTime === "number"
    ) {
      const etaUncached = uncachedDays * averageUncachedResponseTime
      const etaCached = cachedDays * averageCachedResponseTime
      estimatedTimeRemaining = Math.round((etaUncached + etaCached) / 1000)
    }

    const progress: SearchProgress = {
      sessionId,
      currentDay,
      totalDays,
      isComplete: isComplete || currentDay >= totalDays,
      estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
      currentDate,
      startTime,
      lastUpdate: now,
      results: results || undefined,
    }

    // Progress speichern
    progressCache.set(sessionId, { ...progress, updatedAt: Date.now() })

    console.log(
      `📊 Progress update: ${currentDay}/${totalDays} days (${Math.round(
        (currentDay / totalDays) * 100,
      )}%) - ETA: ${estimatedTimeRemaining}s`,
    )

    return new Response(JSON.stringify(progress))
  } catch (error) {
    console.error("Error updating progress:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
  }
}