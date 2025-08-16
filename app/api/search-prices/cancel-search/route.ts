import { NextRequest, NextResponse } from "next/server"

// Storage für abgebrochene Sessions
const cancelledSessions = new Set<string>()

// GET - Prüfe ob Session abgebrochen wurde
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const isCancelled = cancelledSessions.has(sessionId)
    
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
    if (cancelledSessions.has(sessionId)) {
      return NextResponse.json({ 
        success: true, 
        sessionId,
        message: "Session already marked as cancelled",
        wasAlreadyCancelled: true
      })
    }

    // Session als abgebrochen markieren
    cancelledSessions.add(sessionId)
    
    console.log(`🛑 Session ${sessionId} cancelled (reason: ${reason})`)
    
    // Auto-cleanup nach 5 Minuten
    setTimeout(() => {
      cancelledSessions.delete(sessionId)
      console.log(`🧹 Cleaned up cancelled session ${sessionId}`)
    }, 5 * 60 * 1000)

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