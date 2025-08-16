import { type NextRequest, NextResponse } from "next/server"
import { globalRateLimiter } from './rate-limiter'
import { searchBahnhof, getBestPrice } from './bahn-api'
import { updateProgress, updateAverageResponseTimes, getAverageResponseTimes } from './utils'
import { generateCacheKey, getCachedResult, getCacheSize } from './cache'

// Hilfsfunktion für lokales Datum im Format YYYY-MM-DD
function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface TrainResult {
  preis: number
  info: string
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  allIntervals?: Array<{
    preis: number
    abfahrtsZeitpunkt: string
    ankunftsZeitpunkt: string
    abfahrtsOrt: string
    ankunftsOrt: string
    info: string
    umstiegsAnzahl: number
  }>
}

interface TrainResults {
  [date: string]: TrainResult
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId: providedSessionId,
      start,
      ziel,
      tage, // Array der gewünschten Tage im Format ["2024-07-01", "2024-07-03", ...]
      reisezeitraumAb, // Fallback falls tage nicht übergeben wird
      dayLimit, // Fallback falls tage nicht übergeben wird
      alter,
      ermaessigungArt,
      ermaessigungKlasse,
      klasse,
      schnelleVerbindungen,
      nurDeutschlandTicketVerbindungen,
      maximaleUmstiege,
      abfahrtAb,
      ankunftBis,
    } = body

    console.log("\n🚂 Starting bestpreissuche request")

    if (!start || !ziel) {
      return NextResponse.json({ error: "Start and destination required" }, { status: 400 })
    }

    // Verwende die übergebene sessionId oder generiere eine neue
    const sessionId = providedSessionId || crypto.randomUUID()
    console.log(`📱 Session ID: ${sessionId}`)

    // Search for stations
    console.log("\n📍 Searching for stations...")
    const startStation = await searchBahnhof(start)
    const zielStation = await searchBahnhof(ziel)

    if (!startStation || !zielStation) {
      return NextResponse.json(
        {
          error: `Station not found. Start: ${startStation ? "✓" : "✗"}, Ziel: ${zielStation ? "✓" : "✗"}`,
        },
        { status: 404 },
      )
    }

    // Streaming Response Setup
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let isStreamClosed = false
        let cancelNotificationSent = false  // Verhindere mehrfache Cancel-Notifications
        let cancelLoggedForSession = false  // Verhindere mehrfache Cancel-Logs pro Session
        
        // Helper function to safely enqueue data
        const safeEnqueue = (data: Uint8Array) => {
          if (!isStreamClosed) {
            try {
              controller.enqueue(data)
              return true
            } catch (error) {
              if (!cancelNotificationSent) {
                console.log(`ℹ️ User disconnected - search stopped gracefully (session: ${sessionId})`)
                cancelNotificationSent = true
              }
              isStreamClosed = true
              return false
            }
          }
          return false
        }
        
        // Helper function to safely close stream
        const safeClose = () => {
          if (!isStreamClosed) {
            try {
              controller.close()
              isStreamClosed = true
            } catch (error) {
              console.log(`ℹ️ Stream was already closed by user`)
              isStreamClosed = true
            }
          }
        }
        
        try {
          // Verwende tage-Array wenn vorhanden, sonst fallback zu altem System
          let datesToProcess: string[] = []
          let maxDays = 0

          if (tage && Array.isArray(tage) && tage.length > 0) {
            // Neues System: Verwende die übergebenen Tage
            datesToProcess = tage.slice(0, 30) // Limitiere auf max 30 Tage
            maxDays = datesToProcess.length
            console.log(`\n🔍 Using provided dates array: ${datesToProcess.length} specific dates`)
            console.log(`📅 Dates to process: ${datesToProcess.join(', ')}`)
          } else {
            // Fallback: Altes System mit Zeitraum
            const [jahr, monat, tag] = reisezeitraumAb.split("-").map(Number)
            const startDate = new Date(jahr, monat - 1, tag)
            maxDays = Math.min(Math.max(Number.parseInt(dayLimit || "3"), 1), 30)
            
            for (let dayCount = 0; dayCount < maxDays; dayCount++) {
              const currentDate = new Date(startDate)
              currentDate.setDate(currentDate.getDate() + dayCount)
              datesToProcess.push(formatDateKey(currentDate))
            }
            console.log(`\n🔍 Using fallback date range: ${maxDays} consecutive days starting from ${formatDateKey(startDate)}`)
          }

          console.log(`📊 Cache status: ${getCacheSize()} entries`)

          // Erstelle Liste aller Tage mit Cache-Status
          const dayStatusList: { date: string; isCached: boolean }[] = []
          for (const dateStr of datesToProcess) {
            const cacheKey = generateCacheKey({
              startStationId: startStation.normalizedId,
              zielStationId: zielStation.normalizedId,
              date: dateStr,
              alter,
              ermaessigungArt: ermaessigungArt || "KEINE_ERMAESSIGUNG",
              ermaessigungKlasse: ermaessigungKlasse || "KLASSENLOS",
              klasse,
              maximaleUmstiege: Number.parseInt(maximaleUmstiege || "0"),
              schnelleVerbindungen: Boolean(schnelleVerbindungen === true || schnelleVerbindungen === "true"),
              nurDeutschlandTicketVerbindungen: Boolean(
                nurDeutschlandTicketVerbindungen === true || nurDeutschlandTicketVerbindungen === "true",
              ),
            })
            const isCached = !!getCachedResult(cacheKey)
            dayStatusList.push({ date: dateStr, isCached })
          }

          // Gesamtanzahl der gecachten und ungecachten Tage für die gesamte Suche
          let totalUncachedDays = dayStatusList.filter((d) => !d.isCached).length
          let totalCachedDays = dayStatusList.filter((d) => d.isCached).length
          const avgTimes = getAverageResponseTimes()

          // Meta-Daten für Frontend
          const metaData = {
            startStation: startStation,
            zielStation: zielStation,
            searchParams: {
              klasse,
              maximaleUmstiege,
              schnelleVerbindungen,
              nurDeutschlandTicketVerbindungen,
              abfahrtAb,
              ankunftBis,
            },
            sessionId,
          }

          const results: TrainResults = {}

          // Initialer Progress-Update - zeigt sofort die Queue-Size an
          const queueStatus = globalRateLimiter.getQueueStatus()
          await updateProgress(
            sessionId,
            0, // Start bei Tag 0
            maxDays,
            datesToProcess[0] || "",
            false,
            totalUncachedDays,
            totalCachedDays,
            avgTimes.uncached,
            avgTimes.cached,
            queueStatus.queueSize,
            queueStatus.activeRequests
          )

          // Starte alle Requests parallel (nicht sequenziell!)
          const requestPromises = datesToProcess.map(async (currentDateStr, dayCount) => {
            const isCached = dayStatusList[dayCount].isCached
            const currentDate = new Date(currentDateStr)
            const t0 = Date.now()

            const dayResponse = await getBestPrice({
              abfahrtsHalt: startStation.id,
              ankunftsHalt: zielStation.id,
              startStationNormalizedId: startStation.normalizedId,
              zielStationNormalizedId: zielStation.normalizedId,
              anfrageDatum: currentDate,
              sessionId,
              alter,
              ermaessigungArt,
              ermaessigungKlasse,
              klasse,
              maximaleUmstiege: Number.parseInt(maximaleUmstiege || "0"),
              schnelleVerbindungen: schnelleVerbindungen === true || schnelleVerbindungen === "1",
              nurDeutschlandTicketVerbindungen:
                nurDeutschlandTicketVerbindungen === true || nurDeutschlandTicketVerbindungen === "1",
              abfahrtAb,
              ankunftBis,
              cancelLoggedForSession, // Teile den Cancel-Log Status
            })

            const duration = Date.now() - t0
            updateAverageResponseTimes(duration, isCached)

            return { currentDateStr, dayResponse, dayCount }
          })

          // Verarbeite Ergebnisse sobald sie ankommen
          let completedRequests = 0
          const processResult = async (resultPromise: Promise<any>) => {
            try {
              const { currentDateStr, dayResponse, dayCount } = await resultPromise
              completedRequests++

              if (dayResponse.result) {
                Object.assign(results, dayResponse.result)
                //console.log(`Day ${currentDateStr} result:`, Object.values(dayResponse.result)[0])
                
                // Stream einzelnes Tagesergebnis
                const dayResult = {
                  type: 'dayResult',
                  date: currentDateStr,
                  result: Object.values(dayResponse.result)[0],
                  meta: metaData
                }
                
                if (!safeEnqueue(encoder.encode(JSON.stringify(dayResult) + '\n'))) {
                  // User disconnected - stop processing but don't log multiple times
                  return false
                }
              }

              // Progress-Update nach jedem abgeschlossenen Request
              const updatedQueueStatus = globalRateLimiter.getQueueStatus()
              const updatedAvgTimes = getAverageResponseTimes()
              await updateProgress(
                sessionId,
                completedRequests,
                maxDays,
                currentDateStr,
                false,
                Math.max(0, totalUncachedDays - completedRequests),
                Math.max(0, totalCachedDays - completedRequests),
                updatedAvgTimes.uncached,
                updatedAvgTimes.cached,
                updatedQueueStatus.queueSize,
                updatedQueueStatus.activeRequests
              )

              return true
            } catch (error) {
              completedRequests++
              
              // Behandle cancelled sessions nicht als Fehler
              if (error instanceof Error && error.message.includes('was cancelled')) {
                if (!cancelLoggedForSession) {
                  console.log(`ℹ️ Search was cancelled by user (session: ${sessionId})`)
                  cancelLoggedForSession = true
                }
                return true
              }
              
              console.error(`❌ Error processing request:`, error)
              return true
            }
          }

          // Warte auf alle Requests, aber verarbeite sie sobald sie fertig sind
          await Promise.all(requestPromises.map(processResult))

          // Final Progress-Update
          const finalQueueStatus = globalRateLimiter.getQueueStatus()
          const finalAvgTimes = getAverageResponseTimes()
          await updateProgress(
            sessionId, 
            maxDays, 
            maxDays, 
            datesToProcess[maxDays - 1] || "",
            true,
            0,
            0,
            finalAvgTimes.uncached,
            finalAvgTimes.cached,
            finalQueueStatus.queueSize,
            finalQueueStatus.activeRequests
          )

          console.log(`\n✅ Bestpreissuche completed: ${Object.keys(results).length} days processed`)
          console.log(`📊 Final cache status: ${getCacheSize()} entries`)

          // Add station info for booking links
          const resultsWithStations = {
            ...results,
            _meta: metaData,
          }

          // Stream vollständige Ergebnisse am Ende
          const completeResult = {
            type: 'complete',
            results: resultsWithStations
          }
          
          // Nur senden wenn Stream noch aktiv ist
          if (safeEnqueue(encoder.encode(JSON.stringify(completeResult) + '\n'))) {
            safeClose()
          }
          
        } catch (error) {
          console.error("Error in streaming bestpreissuche:", error)
          const errorResult = {
            type: 'error',
            error: "Internal server error",
            details: error instanceof Error ? error.message : "Unknown error"
          }
          safeEnqueue(encoder.encode(JSON.stringify(errorResult) + '\n'))
          safeClose()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error("Error in bestpreissuche API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
