import { NextRequest, NextResponse } from "next/server"
import { globalRateLimiter } from "../rate-limiter"

// GET - Prüfe ob Session abgebrochen wurde
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const isCancelled = globalRateLimiter.isSessionCancelledSync(sessionId)
    
    return NextResponse.json({
      isCancelled,
      sessionId
    })
  } catch (error) {
    console.error("Error checking cancel status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Session als abgebrochen markieren
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { sessionId, reason = 'user_request' } = data
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    // Prüfe ob Session bereits als abgebrochen markiert ist
    if (globalRateLimiter.isSessionCancelledSync(sessionId)) {
      return NextResponse.json({ 
        success: true, 
        sessionId,
        message: "Session already marked as cancelled",
        wasAlreadyCancelled: true
      })
    }

    // Informiere Rate-Limiter über Cancel
    globalRateLimiter.cancelSession(sessionId, reason)
    
    console.log(`🛑 Session ${sessionId} cancelled (reason: ${reason})`)

    return NextResponse.json({ 
      success: true, 
      sessionId,
      message: "Session marked as cancelled" 
    })
  } catch (error) {
    console.error("Error cancelling session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}