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

// In-Memory Progress Store
const progressStore = new Map<string, SearchProgress>()

// Cleanup old progress entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, progress] of progressStore.entries()) {
    // Remove entries older than 30 minutes
    if (now - progress.lastUpdate > 30 * 60 * 1000) {
      progressStore.delete(sessionId)
    }
  }
}, 5 * 60 * 1000)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
  }
  
  const progress = progressStore.get(sessionId)
  
  if (!progress) {
    return NextResponse.json({ 
      error: 'Session not found',
      sessionId,
      currentDay: 0,
      totalDays: 0,
      isComplete: false,
      estimatedTimeRemaining: 0,
      currentDate: ''
    }, { status: 404 })
  }
  
  return NextResponse.json(progress)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, currentDay, totalDays, currentDate, isComplete, results } = body
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    
    const now = Date.now()
    const existingProgress = progressStore.get(sessionId)
    
    let estimatedTimeRemaining = 0
    let startTime = now
    
    if (existingProgress) {
      startTime = existingProgress.startTime
      const elapsed = now - startTime
      const avgTimePerDay = elapsed / Math.max(currentDay, 1)
      const remainingDays = totalDays - currentDay
      estimatedTimeRemaining = Math.round((avgTimePerDay * remainingDays) / 1000)
    } else if (currentDay > 0) {
      // Estimate based on current progress if no existing data
      const elapsed = 3000 // Assume 3 seconds per day as default
      const avgTimePerDay = elapsed
      const remainingDays = totalDays - currentDay
      estimatedTimeRemaining = Math.round((avgTimePerDay * remainingDays) / 1000)
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
      results: results || undefined
    }
    
    progressStore.set(sessionId, progress)
    
    console.log(`📊 Progress update: ${currentDay}/${totalDays} days (${Math.round((currentDay/totalDays)*100)}%) - ETA: ${estimatedTimeRemaining}s`)
    
    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}