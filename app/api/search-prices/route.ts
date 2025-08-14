import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Durchschnittswerte für Response-Zeiten (ms) - global für alle Sessions
let averageUncachedResponseTime = 2000 // Startwert 2s
let averageCachedResponseTime = 100 // Startwert 0.1s
const alpha = 0.2 // Glättungsfaktor für gleitenden Mittelwert

// Progress-Update-Funktion
async function updateProgress(
  sessionId: string,
  currentDay: number,
  totalDays: number,
  currentDate: string,
  isComplete = false,
  uncachedDays?: number,
  cachedDays?: number,
  avgUncachedTime?: number,
  avgCachedTime?: number,
) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/search-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        currentDay,
        totalDays,
        currentDate,
        isComplete,
        uncachedDays,
        cachedDays,
        averageUncachedResponseTime: avgUncachedTime,
        averageCachedResponseTime: avgCachedTime,
      }),
    })
  } catch (error) {
    console.error("Error updating progress:", error)
  }
}

// Cache-Interface
interface CacheEntry {
  data: TrainResults | null
  timestamp: number
  ttl: number // Time to live in milliseconds
}

// In-Memory Cache
const cache = new Map<string, CacheEntry>()

// Cache-Konfiguration
const CACHE_TTL = 30 * 60 * 1000 // 30 Minuten in Millisekunden
const MAX_CACHE_ENTRIES = 10000

// Cache-Hilfsfunktionen
function generateCacheKey(params: {
  startStationId: string
  zielStationId: string
  date: string
  alter: string
  ermaessigungArt: string
  ermaessigungKlasse: string
  klasse: string
  maximaleUmstiege: number
  schnelleVerbindungen: boolean
  nurDeutschlandTicketVerbindungen: boolean
  abfahrtAb?: string
  ankunftBis?: string
}): string {
  return JSON.stringify(params)
}

function getCachedResult(cacheKey: string): TrainResults | null {
  console.log(`🔍 Looking for cache key: ${cacheKey.substring(0, 100)}...`)
  console.log(`📊 Cache currently has ${cache.size} entries`)
  
  const entry = cache.get(cacheKey)
  if (!entry) {
    console.log(`❌ No cache entry found`)
    return null
  }
  
  const now = Date.now()
  const age = now - entry.timestamp
  console.log(`⏱️ Cache entry age: ${Math.round(age / 1000)}s, TTL: ${Math.round(entry.ttl / 1000)}s`)
  
  if (age > entry.ttl) {
    // Cache ist abgelaufen
    console.log(`⏰ Cache entry expired`)
    cache.delete(cacheKey)
    return null
  }
  
  console.log(`📦 Cache hit for key: ${cacheKey.substring(0, 100)}...`)
  return entry.data
}

function setCachedResult(cacheKey: string, data: TrainResults | null): void {
  // LRU-Prinzip: Wenn Limit erreicht, entferne ältesten Eintrag
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (typeof oldestKey === 'string') {
      cache.delete(oldestKey)
      console.log(`🗑️ Removed oldest cache entry to keep cache size <= ${MAX_CACHE_ENTRIES}`)
    }
  }
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  })
  console.log(`💾 Cached result for key: ${cacheKey.substring(0, 100)}...`)
  console.log(`📊 Cache now has ${cache.size} entries`)
}

// Cache-Bereinigung (entfernt abgelaufene Einträge)
function cleanupCache(): void {
  const now = Date.now()
  let removed = 0
  
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key)
      removed++
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired cache entries. Cache size: ${cache.size}`)
  }
}

// Cache-Bereinigung alle 5 Minuten
setInterval(cleanupCache, 5 * 60 * 1000)

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

async function searchBahnhof(search: string): Promise<{ id: string; normalizedId: string; name: string } | null> {
  if (!search) return null

  try {
    const encodedSearch = encodeURIComponent(search)
    const url = `https://www.bahn.de/web/api/reiseloesung/orte?suchbegriff=${encodedSearch}&typ=ALL&limit=10`

    console.log(`Searching station: "${search}"`)

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        Accept: "application/json",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        Referer: "https://www.bahn.de/",
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data || data.length === 0) return null

    const station = data[0]
    const originalId = station.id

    // Normalisiere die Station-ID: Entferne den Timestamp-Parameter @p=
    const normalizedId = originalId.replace(/@p=\d+@/g, '@')

    console.log(`Found station: ${station.name}`)
    console.log(`Original ID: ${originalId}`)
    console.log(`Normalized ID: ${normalizedId}`)

    // Verwende die normalisierte ID für Caching, aber die originale für API-Aufrufe
    return { 
      id: originalId,           // Für API-Aufrufe
      normalizedId: normalizedId, // Für Cache-Keys
      name: station.name 
    }
  } catch (error) {
    console.error("Error in searchBahnhof:", error)
    return null
  }
}

async function getBestPrice(config: any): Promise<{ result: TrainResults | null; wasApiCall: boolean }> {
  const dateObj = config.anfrageDatum as Date
  // Format date like the working curl: "2025-07-26T08:00:00"
  const datum = formatDateKey(dateObj) + "T08:00:00"
  const tag = formatDateKey(dateObj)

  // Cache-Key generieren (OHNE Zeitfilter - diese werden nur bei der Anzeige angewendet)
  const cacheKey = generateCacheKey({
    startStationId: config.startStationNormalizedId, // Verwende normalisierte ID
    zielStationId: config.zielStationNormalizedId,   // Verwende normalisierte ID
    date: tag,
    alter: config.alter,
    ermaessigungArt: config.ermaessigungArt || "KEINE_ERMAESSIGUNG",
    ermaessigungKlasse: config.ermaessigungKlasse || "KLASSENLOS",
    klasse: config.klasse,
    maximaleUmstiege: config.maximaleUmstiege,
    schnelleVerbindungen: Boolean(config.schnelleVerbindungen === true || config.schnelleVerbindungen === "true"),
    nurDeutschlandTicketVerbindungen: Boolean(config.nurDeutschlandTicketVerbindungen === true || config.nurDeutschlandTicketVerbindungen === "true"),
    // abfahrtAb und ankunftBis NICHT im Cache-Key!
  })

  console.log(`🔑 Cache key for ${tag} (WITHOUT time filters):`)
  console.log(`   startStationId (normalized): ${config.startStationNormalizedId}`)
  console.log(`   zielStationId (normalized): ${config.zielStationNormalizedId}`)
  console.log(`   date: ${tag}`)
  console.log(`   alter: ${config.alter}`)
  console.log(`   schnelleVerbindungen: ${Boolean(config.schnelleVerbindungen === true || config.schnelleVerbindungen === "true")}`)
  console.log(`   Time filters applied at display time: abfahrtAb="${config.abfahrtAb || ""}", ankunftBis="${config.ankunftBis || ""}"`)
  console.log(`   Full key: ${cacheKey.substring(0, 200)}...`)

  // Prüfe Cache
  const cachedResult = getCachedResult(cacheKey)
  if (cachedResult) {
    console.log(`📦 Cache HIT for ${tag} - applying time filters to cached data`)
    
    // Zeitfilterung auf gecachte Daten anwenden
    const cachedData = cachedResult[tag]
    if (cachedData && cachedData.allIntervals) {
      const filteredIntervals = filterByTime(
        cachedData.allIntervals.map(interval => ({
          preis: { betrag: interval.preis },
          verbindungen: [{
            verbindung: {
              verbindungsAbschnitte: [{
                abfahrtsZeitpunkt: interval.abfahrtsZeitpunkt,
                ankunftsZeitpunkt: interval.ankunftsZeitpunkt,
                abfahrtsOrt: interval.abfahrtsOrt,
                ankunftsOrt: interval.ankunftsOrt
              }]
            }
          }]
        })), 
        config.abfahrtAb, 
        config.ankunftBis
      )
      
      if (filteredIntervals.length === 0) {
        return {
          result: { [tag]: { preis: 0, info: "Keine Verbindungen im gewählten Zeitraum!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "", allIntervals: [] } },
          wasApiCall: false
        }
      }
      
      // Finde günstigste gefilterte Verbindung
      const filteredPrices = filteredIntervals.map(iv => iv.preis.betrag)
      const minPreis = Math.min(...filteredPrices)
      const bestInterval = cachedData.allIntervals.find(interval => interval.preis === minPreis)
      
      const filteredAllIntervals = cachedData.allIntervals.filter(interval => {
        return filteredIntervals.some(fi => {
          const fiConnection = fi.verbindungen[0].verbindung.verbindungsAbschnitte[0]
          return interval.abfahrtsZeitpunkt === fiConnection.abfahrtsZeitpunkt &&
                 interval.ankunftsZeitpunkt === fiConnection.ankunftsZeitpunkt
        })
      }).sort((a, b) => a.preis - b.preis)
      
      const filteredResult = {
        [tag]: {
          preis: minPreis,
          info: bestInterval?.info || "",
          abfahrtsZeitpunkt: bestInterval?.abfahrtsZeitpunkt || "",
          ankunftsZeitpunkt: bestInterval?.ankunftsZeitpunkt || "",
          allIntervals: filteredAllIntervals
        }
      }
      
      return { result: filteredResult, wasApiCall: false }
    }
    
    return { result: cachedResult, wasApiCall: false }
  }

  console.log(`❌ Cache MISS for ${tag} - fetching from API`)

  console.log(`\n=== Getting best price for ${tag} (NOT CACHED) ===`)

  // Match the EXACT working curl request structure
  const requestBody = {
    abfahrtsHalt: config.abfahrtsHalt,
    anfrageZeitpunkt: datum,
    ankunftsHalt: config.ankunftsHalt,
    ankunftSuche: "ABFAHRT",
    klasse: config.klasse,
    maxUmstiege: config.maximaleUmstiege,
    produktgattungen: ["ICE", "EC_IC", "IR", "REGIONAL", "SBAHN", "BUS", "SCHIFF", "UBAHN", "TRAM", "ANRUFPFLICHTIG"],
    reisende: [
      {
        typ: config.alter, 
        ermaessigungen: [
          {
            art: config.ermaessigungArt || "KEINE_ERMAESSIGUNG",
            klasse: config.ermaessigungKlasse || "KLASSENLOS",
          },
        ],
        alter: [],
        anzahl: 1,
      },
    ],
    schnelleVerbindungen: config.schnelleVerbindungen === true || config.schnelleVerbindungen === "true",
    sitzplatzOnly: false,
    bikeCarriage: false,
    reservierungsKontingenteVorhanden: false,
    nurDeutschlandTicketVerbindungen:
      config.nurDeutschlandTicketVerbindungen === true || config.nurDeutschlandTicketVerbindungen === "true",
    deutschlandTicketVorhanden: false,
  }

  try {
    // Match the working curl headers exactly
    const response = await fetch("https://www.bahn.de/web/api/angebote/tagesbestpreis", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Encoding": "gzip",
        Origin: "https://www.bahn.de",
        Referer: "https://www.bahn.de/buchung/fahrplan/suche",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        Connection: "close",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
        console.error(`HTTP ${response.status} error:`, errorText)
      } catch (e) {
        console.error("Could not read error response")
      }

      const errorResult = {
        [tag]: {
          preis: 0,
          info: `API Error ${response.status}: ${errorText.slice(0, 100)}`,
          abfahrtsZeitpunkt: "",
          ankunftsZeitpunkt: "",
        },
      }
      
      return { result: errorResult, wasApiCall: true }
    }

    const responseText = await response.text()

    // Check if response contains error message
    if (responseText.includes("Preisauskunft nicht möglich")) {
      console.log("Price info not available for this date")
      const result = { [tag]: { preis: 0, info: "Kein Bestpreis verfügbar!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" } }
      setCachedResult(cacheKey, result)
      return { result, wasApiCall: true }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError)
      const errorResult = {
        [tag]: {
          preis: 0,
          info: "JSON Parse Error",
          abfahrtsZeitpunkt: "",
          ankunftsZeitpunkt: "",
        },
      }
      return { result: errorResult, wasApiCall: true }
    }

    if (!data || !data.intervalle) {
      console.log("No intervals found in response")
      const result = { [tag]: { preis: 0, info: "Keine Intervalle gefunden!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" } }
      setCachedResult(cacheKey, result)
      return { result, wasApiCall: true }
    }

    console.log(`Found ${data.intervalle.length} intervals`)

    // Verarbeite ALLE Intervalle für Cache (ohne Zeitfilter)
    const allIntervalsForCache: Array<{
      preis: number
      abfahrtsZeitpunkt: string
      ankunftsZeitpunkt: string
      abfahrtsOrt: string
      ankunftsOrt: string
      info: string
      umstiegsAnzahl: number
    }> = []

    // Process ALL intervals (für Cache)
    for (const iv of data.intervalle) {
      let newPreis = 0

      if (iv.preis && typeof iv.preis === "object" && "betrag" in iv.preis) {
        newPreis = iv.preis.betrag

        if (iv.verbindungen && iv.verbindungen[0] && iv.verbindungen[0].verbindung) {
          const verbindungsAbschnitte = iv.verbindungen[0].verbindung.verbindungsAbschnitte
          
          if (verbindungsAbschnitte && verbindungsAbschnitte.length > 0) {
            // Erste Abfahrt und letzte Ankunft für korrekte Start/Ziel-Anzeige
            const firstConnection = verbindungsAbschnitte[0]
            const lastConnection = verbindungsAbschnitte[verbindungsAbschnitte.length - 1]

            const abfahrt = new Date(firstConnection.abfahrtsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const ankunft = new Date(lastConnection.ankunftsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const info = `${abfahrt} ${firstConnection.abfahrtsOrt} -> ${ankunft} ${lastConnection.ankunftsOrt}`

            // Store ALL intervals for cache
            allIntervalsForCache.push({
              preis: newPreis,
              abfahrtsZeitpunkt: firstConnection.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: lastConnection.ankunftsZeitpunkt,
              abfahrtsOrt: firstConnection.abfahrtsOrt,
              ankunftsOrt: lastConnection.ankunftsOrt,
              info: info,
              umstiegsAnzahl: iv.verbindungen[0].verbindung.umstiegsAnzahl || 0,
            })
          }
        }
      }

      if (newPreis !== 0) {
        console.log(`Found price: ${newPreis}€`)
      }
    }

    console.log(`Total intervals stored: ${allIntervalsForCache.length}`)

    // Erstelle vollständigen Cache-Eintrag mit ALLEN Verbindungen
    const fullResult = {
      [tag]: {
        preis: 0, // Wird später gesetzt
        info: "",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: allIntervalsForCache.sort((a, b) => a.preis - b.preis), // Sort by price
      },
    }

    // Cache ALLE Daten (ohne Zeitfilter)
    setCachedResult(cacheKey, fullResult)

    // Jetzt Zeitfilter für aktuelle Anfrage anwenden
    const filteredIntervalle = filterByTime(data.intervalle, config.abfahrtAb, config.ankunftBis)
    console.log(`After time filtering: ${filteredIntervalle.length} intervals`)

    if (filteredIntervalle.length === 0) {
      console.log("No intervals remaining after time filtering")
      const result = { [tag]: { preis: 0, info: "Keine Verbindungen im gewählten Zeitraum!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "", allIntervals: [] } }
      return { result, wasApiCall: true }
    }

    const preise: { [key: string]: number } = {}
    const allIntervals: Array<{
      preis: number
      abfahrtsZeitpunkt: string
      ankunftsZeitpunkt: string
      abfahrtsOrt: string
      ankunftsOrt: string
      info: string
      umstiegsAnzahl: number
    }> = []
    let bestConnection: any = null

    // Process intervals
    for (const iv of filteredIntervalle) {
      let newPreis = 0

      if (iv.preis && typeof iv.preis === "object" && "betrag" in iv.preis) {
        newPreis = iv.preis.betrag

        if (iv.verbindungen && iv.verbindungen[0] && iv.verbindungen[0].verbindung) {
          const verbindungsAbschnitte = iv.verbindungen[0].verbindung.verbindungsAbschnitte
          
          if (verbindungsAbschnitte && verbindungsAbschnitte.length > 0) {
            // Erste Abfahrt und letzte Ankunft für korrekte Start/Ziel-Anzeige
            const firstConnection = verbindungsAbschnitte[0]
            const lastConnection = verbindungsAbschnitte[verbindungsAbschnitte.length - 1]

            const abfahrt = new Date(firstConnection.abfahrtsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const ankunft = new Date(lastConnection.ankunftsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const info = `${abfahrt} ${firstConnection.abfahrtsOrt} -> ${ankunft} ${lastConnection.ankunftsOrt}`
            preise[info + newPreis] = newPreis

            // Store all intervals for detailed view
            allIntervals.push({
              preis: newPreis,
              abfahrtsZeitpunkt: firstConnection.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: lastConnection.ankunftsZeitpunkt,
              abfahrtsOrt: firstConnection.abfahrtsOrt,
              ankunftsOrt: lastConnection.ankunftsOrt,
              info: info,
              umstiegsAnzahl: iv.verbindungen[0].verbindung.umstiegsAnzahl || 0,
            })

            // Store the connection for the cheapest price
            if (!bestConnection || newPreis < bestConnection.preis) {
              bestConnection = {
                preis: newPreis,
                connection: firstConnection, // Use first connection for departure time
                ankunftsZeitpunkt: lastConnection.ankunftsZeitpunkt, // But last connection for arrival time
                info: info,
              }
            }
          }
        }
      }

      if (newPreis !== 0) {
        console.log(`Found price: ${newPreis}€`)
      }
    }

    console.log(`Total prices found: ${Object.keys(preise).length}`)

    if (Object.keys(preise).length === 0) {
      const result = { [tag]: { preis: 0, info: "Keine gültigen Preise gefunden!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" } }
      return { result, wasApiCall: true }
    }

    // Find the cheapest price
    const minPreis = Math.min(...Object.values(preise))
    const infoKey = Object.keys(preise).find((key) => preise[key] === minPreis)
    const info = infoKey ? infoKey.replace(minPreis.toString(), "") : ""

    console.log(`Best price for ${tag}: ${minPreis}€`)

    const result = {
      [tag]: {
        preis: minPreis,
        info,
        abfahrtsZeitpunkt: bestConnection?.connection?.abfahrtsZeitpunkt || "",
        ankunftsZeitpunkt: bestConnection?.connection?.ankunftsZeitpunkt || "",
        allIntervals: allIntervals.sort((a, b) => a.preis - b.preis), // Sort by price
      },
    }

    // Ergebnis cachen - NICHT mehr nötig, da bereits gecacht
    // setCachedResult(cacheKey, result)
    
    return { result, wasApiCall: true }
  } catch (error) {
    console.error(`Error in bestpreissuche for ${tag}:`, error)
    const result = {
      [tag]: {
        preis: 0,
        info: `Fetch Error: ${error instanceof Error ? error.message : "Unknown"}`,
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
      },
    }
    // Fehler nur kurz cachen (1 Minute)
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: 60 * 1000 // 1 Minute
    })
    return { result, wasApiCall: true }
  }
}

// Hilfsfunktion für lokales Datum im Format YYYY-MM-DD
function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Hilfsfunktion für Zeitfilterung
function filterByTime(intervals: any[], abfahrtAb?: string, ankunftBis?: string) {
  if (!abfahrtAb && !ankunftBis) return intervals
  
  return intervals.filter(interval => {
    if (!interval.verbindungen?.[0]?.verbindung?.verbindungsAbschnitte) return true
    
    const abschnitte = interval.verbindungen[0].verbindung.verbindungsAbschnitte
    if (!abschnitte.length) return true
    
    // Erste Abfahrt und letzte Ankunft
    const ersteAbfahrt = new Date(abschnitte[0].abfahrtsZeitpunkt)
    const letzteAnkunft = new Date(abschnitte[abschnitte.length - 1].ankunftsZeitpunkt)
    
    // Prüfe Abfahrtszeit
    if (abfahrtAb) {
      const abfahrtFilter = new Date(`1970-01-01T${abfahrtAb}:00`)
      const connectionTime = new Date(`1970-01-01T${ersteAbfahrt.getHours().toString().padStart(2, '0')}:${ersteAbfahrt.getMinutes().toString().padStart(2, '0')}:00`)
      
      if (connectionTime < abfahrtFilter) return false
    }
    
    // Prüfe Ankunftszeit (mit Behandlung von Nachtverbindungen)
    if (ankunftBis) {
      const ankunftFilter = new Date(`1970-01-01T${ankunftBis}:00`)
      
      // Prüfe ob es sich um eine Nachtverbindung handelt (Ankunft am nächsten Tag)
      const istNachtverbindung = letzteAnkunft.getTime() < ersteAbfahrt.getTime() || 
                                 (letzteAnkunft.getDate() !== ersteAbfahrt.getDate())
      
      let connectionTime: Date
      
      if (istNachtverbindung) {
        // Für Nachtverbindungen: Ankunftszeit am nächsten Tag (+ 24h)
        connectionTime = new Date(`1970-01-02T${letzteAnkunft.getHours().toString().padStart(2, '0')}:${letzteAnkunft.getMinutes().toString().padStart(2, '0')}:00`)
      } else {
        // Normale Verbindung: Ankunftszeit am gleichen Tag
        connectionTime = new Date(`1970-01-01T${letzteAnkunft.getHours().toString().padStart(2, '0')}:${letzteAnkunft.getMinutes().toString().padStart(2, '0')}:00`)
      }
      
      if (connectionTime > ankunftFilter) return false
    }
    
    return true
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId: providedSessionId,
      start,
      ziel,
      reisezeitraumAb,
      alter,
      ermaessigungArt,
      ermaessigungKlasse,
      klasse,
      schnelleVerbindungen,
      nurDeutschlandTicketVerbindungen,
      maximaleUmstiege,
      dayLimit,
      abfahrtAb,
      ankunftBis,
    } = body

    console.log("\n🚂 Starting bestpreissuche request")

    if (!start || !ziel) {
      return NextResponse.json({ error: "Start and destination required" }, { status: 400 })
    }

    // Verwende die übergebene sessionId oder generiere eine neue
    const sessionId = providedSessionId || randomUUID()
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

    // Limit to 3 days for faster results
    // Startdatum korrekt als lokales Datum parsen
    const [jahr, monat, tag] = reisezeitraumAb.split("-").map(Number)
    const startDate = new Date(jahr, monat - 1, tag)
    const results: TrainResults = {}
    const currentDate = new Date(startDate)
    const maxDays = Math.min(Math.max(Number.parseInt(dayLimit || "3"), 1), 30) // Between 1 and 30 days

    console.log(`\n🔍 Searching prices for ${maxDays} days starting from ${formatDateKey(startDate)}`)
    console.log(`📊 Cache status: ${cache.size} entries`)

    // Erstelle Liste aller Tage mit Cache-Status
    const dayStatusList: { date: string; isCached: boolean }[] = []
    for (let dayCount = 0; dayCount < maxDays; dayCount++) {
      const testDate = new Date(startDate)
      testDate.setDate(testDate.getDate() + dayCount)
      const cacheKey = generateCacheKey({
        startStationId: startStation.normalizedId,
        zielStationId: zielStation.normalizedId,
        date: formatDateKey(testDate),
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
      // Hier wird der Cache nur geprüft, nicht gefüllt.
      const cachedEntry = cache.get(cacheKey)
      const isCached = !!cachedEntry && Date.now() - cachedEntry.timestamp <= cachedEntry.ttl
      dayStatusList.push({ date: formatDateKey(testDate), isCached })
    }

    // Gesamtanzahl der gecachten und ungecachten Tage für die gesamte Suche
    let totalUncachedDays = dayStatusList.filter((d) => !d.isCached).length
    let totalCachedDays = dayStatusList.filter((d) => d.isCached).length

    for (let dayCount = 0; dayCount < maxDays; dayCount++) {
      const currentDateStr = formatDateKey(currentDate)
      const isCached = dayStatusList[dayCount].isCached

      // Zeitmessung starten
      const t0 = Date.now()

      // Übergib das Date-Objekt direkt
      const dayResponse = await getBestPrice({
        abfahrtsHalt: startStation.id,
        ankunftsHalt: zielStation.id,
        startStationNormalizedId: startStation.normalizedId,
        zielStationNormalizedId: zielStation.normalizedId,
        anfrageDatum: new Date(currentDate),
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
      })

      // Zeitmessung beenden und Mittelwert aktualisieren
      const duration = Date.now() - t0
      if (isCached) {
        averageCachedResponseTime = alpha * duration + (1 - alpha) * averageCachedResponseTime
      } else {
        // Die 'duration' ist die korrekte API-Antwortzeit. Die 1s Wartezeit ist separat.
        averageUncachedResponseTime = alpha * duration + (1 - alpha) * averageUncachedResponseTime
      }

      // Reduziere die verbleibenden Tage nach der Verarbeitung
      if (isCached) {
        totalCachedDays--
      } else {
        totalUncachedDays--
      }

      // Progress-Update senden NACH dem Request
      await updateProgress(
        sessionId,
        dayCount + 1, // Zählung bei 1 beginnen für die Anzeige
        maxDays,
        currentDateStr,
        false,
        totalUncachedDays, // Übergib die verbleibende Gesamtanzahl
        totalCachedDays,
        averageUncachedResponseTime,
        averageCachedResponseTime,
      )

      if (dayResponse.result) {
        Object.assign(results, dayResponse.result)
        console.log(`Day ${formatDateKey(currentDate)} result:`, Object.values(dayResponse.result)[0])
      }

      // Rate limiting: Nur bei API-Aufrufen warten
      if (dayResponse.wasApiCall) {
        console.log(`⏳ Rate limiting: Waiting 1s after API call for ${formatDateKey(currentDate)}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Final Progress-Update
    const finalDate = new Date(startDate)
    finalDate.setDate(finalDate.getDate() + maxDays)
    await updateProgress(sessionId, maxDays, maxDays, formatDateKey(finalDate), true)

    console.log(`\n✅ Bestpreissuche completed: ${Object.keys(results).length} days processed`)
    console.log(
      `📊 Final average times: API=${Math.round(averageUncachedResponseTime)}ms, Cache=${Math.round(
        averageCachedResponseTime,
      )}ms`,
    )
    console.log(`📊 Final cache status: ${cache.size} entries`)

    // Add station info for booking links
    const resultsWithStations = {
      ...results,
      _meta: {
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
        sessionId, // Session ID für Frontend-Polling
      },
    }

    return NextResponse.json(resultsWithStations)
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
