import { globalRateLimiter } from './rate-limiter'
import { generateCacheKey, getCachedResult, setCachedResult } from './cache'

// Hilfsfunktion für lokales Datum im Format YYYY-MM-DD
function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Station search function
export async function searchBahnhof(search: string): Promise<{ id: string; normalizedId: string; name: string } | null> {
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

interface IntervalAbschnitt {
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  abfahrtsOrt: string
  ankunftsOrt: string
}

interface IntervalDetails {
  preis: number
  abschnitte: IntervalAbschnitt[]
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  abfahrtsOrt: string
  ankunftsOrt: string
  info: string
  umstiegsAnzahl: number
  isCheapestPerInterval?: boolean
}

interface TrainResult {
  preis: number
  info: string
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  allIntervals?: IntervalDetails[]
}

interface TrainResults {
  [date: string]: TrainResult
}

// Main API call function for best price search
export async function getBestPrice(config: any): Promise<{ result: TrainResults | null; wasApiCall: boolean }> {
  const dateObj = config.anfrageDatum as Date
  const sessionId = config.sessionId // Session ID von der Hauptanfrage
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
  console.log(`   Full key: ${cacheKey.substring(0, 200)}...`)

  // Prüfe Cache
  const cachedResult = getCachedResult(cacheKey)
  if (cachedResult) {
    console.log(`📦 Cache HIT for ${tag} - applying time filters to cached data`)
    // Zeitfilterung auf gecachte Daten anwenden
    const cachedData = cachedResult[tag]
    if (cachedData && cachedData.allIntervals) {
      const mappedIntervals: IntervalDetails[] = cachedData.allIntervals.map((interval: any) => {
        if (interval.abschnitte) {
          return {
            ...interval,
            isCheapestPerInterval: interval.isCheapestPerInterval || false
          }
        } else {
          return {
            preis: interval.preis,
            abschnitte: [{
              abfahrtsZeitpunkt: interval.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: interval.ankunftsZeitpunkt,
              abfahrtsOrt: interval.abfahrtsOrt,
              ankunftsOrt: interval.ankunftsOrt
            }],
            abfahrtsZeitpunkt: interval.abfahrtsZeitpunkt,
            ankunftsZeitpunkt: interval.ankunftsZeitpunkt,
            abfahrtsOrt: interval.abfahrtsOrt,
            ankunftsOrt: interval.ankunftsOrt,
            info: interval.info,
            umstiegsAnzahl: interval.umstiegsAnzahl || 0,
            isCheapestPerInterval: false
          }
        }
      })
      const filteredIntervals: IntervalDetails[] = mappedIntervals.filter(interval => {
        const ersteAbfahrt = interval.abfahrtsZeitpunkt
        const letzteAnkunft = interval.ankunftsZeitpunkt
        let abfahrtOk = true
        let ankunftOk = true
        if (config.abfahrtAb) {
          abfahrtOk = ersteAbfahrt >= config.abfahrtAb
        }
        if (config.ankunftBis) {
          ankunftOk = letzteAnkunft <= config.ankunftBis
        }
        return abfahrtOk && ankunftOk
      })
      if (filteredIntervals.length === 0) {
        return {
          result: { [tag]: { preis: 0, info: "Keine Verbindungen im gewählten Zeitraum!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "", allIntervals: [] } },
          wasApiCall: false
        }
      }
      const minPreis = Math.min(...filteredIntervals.map(iv => iv.preis))
      const bestInterval = filteredIntervals.find(interval => interval.preis === minPreis)
      const filteredAllIntervals = filteredIntervals.sort((a, b) => a.preis - b.preis)
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
    // Fallback: Mappe das aktuelle Tag auf das aktuelle Format, falls nötig
    if (cachedData) {
      let mappedIntervals: IntervalDetails[] = []
      if (cachedData.allIntervals) {
        mappedIntervals = cachedData.allIntervals.map((interval: any) => {
          let abschnitteArr
          if (interval.abschnitte && Array.isArray(interval.abschnitte)) {
            abschnitteArr = interval.abschnitte
          } else {
            abschnitteArr = [{
              abfahrtsZeitpunkt: interval.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: interval.ankunftsZeitpunkt,
              abfahrtsOrt: interval.abfahrtsOrt,
              ankunftsOrt: interval.ankunftsOrt
            }]
          }
          return {
            preis: interval.preis,
            abschnitte: abschnitteArr,
            abfahrtsZeitpunkt: interval.abfahrtsZeitpunkt,
            ankunftsZeitpunkt: interval.ankunftsZeitpunkt,
            abfahrtsOrt: interval.abfahrtsOrt,
            ankunftsOrt: interval.ankunftsOrt,
            info: interval.info,
            umstiegsAnzahl: interval.umstiegsAnzahl || 0,
            isCheapestPerInterval: interval.isCheapestPerInterval || false
          }
        })
      }
      const mappedResult: TrainResults = {
        [tag]: {
          ...cachedData,
          allIntervals: mappedIntervals
        }
      }
      return { result: mappedResult, wasApiCall: false }
    }
  }

  console.log(`❌ Cache MISS for ${tag} - fetching from API`)

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
    // API-Call über globalen Rate Limiter
    const requestId = `${tag}-${config.startStationNormalizedId}-${config.zielStationNormalizedId}`
    const apiCallResult = await globalRateLimiter.addToQueue(requestId, async () => {
      console.log(`🌐 Executing API call for ${tag}`)
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
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`)
      }

      return await response.text()
    }, sessionId) // SessionId übergeben für Abbruch-Prüfung

    const responseText = apiCallResult

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
    const allIntervalsForCache: IntervalDetails[] = []

    // Process ALL intervals (für Cache)
    for (const iv of data.intervalle) {
      if (iv.preis && typeof iv.preis === "object" && "betrag" in iv.preis && Array.isArray(iv.verbindungen)) {
        for (const verbindung of iv.verbindungen) {
          let newPreis = 0
          if (verbindung.abPreis && typeof verbindung.abPreis === "object" && "betrag" in verbindung.abPreis) {
            newPreis = verbindung.abPreis.betrag
          } else {
            newPreis = iv.preis.betrag
          }
          if (verbindung.verbindung && verbindung.verbindung.verbindungsAbschnitte && verbindung.verbindung.verbindungsAbschnitte.length > 0) {
            const abschnitte = verbindung.verbindung.verbindungsAbschnitte.map((abschnitt: any) => ({
              abfahrtsZeitpunkt: abschnitt.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: abschnitt.ankunftsZeitpunkt,
              abfahrtsOrt: abschnitt.abfahrtsOrt,
              ankunftsOrt: abschnitt.ankunftsOrt
            }))
            const info = abschnitte.map((a: IntervalAbschnitt) => `${a.abfahrtsOrt} → ${a.ankunftsOrt}`).join(' | ')
            allIntervalsForCache.push({
              preis: newPreis,
              abschnitte,
              abfahrtsZeitpunkt: abschnitte[0].abfahrtsZeitpunkt,
              ankunftsZeitpunkt: abschnitte[abschnitte.length-1].ankunftsZeitpunkt,
              abfahrtsOrt: abschnitte[0].abfahrtsOrt,
              ankunftsOrt: abschnitte[abschnitte.length-1].ankunftsOrt,
              info,
              umstiegsAnzahl: verbindung.verbindung.umstiegsAnzahl || 0,
            })
          }
        }
      }
    }

    // Markiere die günstigste Verbindung pro ursprünglichem Intervall
    const intervalMap = new Map<number, IntervalDetails[]>()
    let intervalIndex = 0
    
    // Gruppiere Verbindungen nach ursprünglichen Intervallen
    for (const iv of data.intervalle) {
      if (iv.preis && typeof iv.preis === "object" && "betrag" in iv.preis && Array.isArray(iv.verbindungen)) {
        const intervalConnections: IntervalDetails[] = []
        
        for (const verbindung of iv.verbindungen) {
          let newPreis = 0
          if (verbindung.abPreis && typeof verbindung.abPreis === "object" && "betrag" in verbindung.abPreis) {
            newPreis = verbindung.abPreis.betrag
          } else {
            newPreis = iv.preis.betrag
          }
          if (verbindung.verbindung && verbindung.verbindung.verbindungsAbschnitte && verbindung.verbindung.verbindungsAbschnitte.length > 0) {
            const abschnitte = verbindung.verbindung.verbindungsAbschnitte.map((abschnitt: any) => ({
              abfahrtsZeitpunkt: abschnitt.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: abschnitt.ankunftsZeitpunkt,
              abfahrtsOrt: abschnitt.abfahrtsOrt,
              ankunftsOrt: abschnitt.ankunftsOrt
            }))
            const info = abschnitte.map((a: IntervalAbschnitt) => `${a.abfahrtsOrt} → ${a.ankunftsOrt}`).join(' | ')
            intervalConnections.push({
              preis: newPreis,
              abschnitte,
              abfahrtsZeitpunkt: abschnitte[0].abfahrtsZeitpunkt,
              ankunftsZeitpunkt: abschnitte[abschnitte.length-1].ankunftsZeitpunkt,
              abfahrtsOrt: abschnitte[0].abfahrtsOrt,
              ankunftsOrt: abschnitte[abschnitte.length-1].ankunftsOrt,
              info,
              umstiegsAnzahl: verbindung.verbindung.umstiegsAnzahl || 0,
            })
          }
        }
        
        if (intervalConnections.length > 0) {
          intervalMap.set(intervalIndex, intervalConnections)
          intervalIndex++
        }
      }
    }
    
    // Markiere günstigste Verbindung pro Intervall
    const finalAllIntervals: IntervalDetails[] = []
    intervalMap.forEach((connections) => {
      const minPrice = Math.min(...connections.map(c => c.preis))
      connections.forEach(connection => {
        finalAllIntervals.push({
          ...connection,
          isCheapestPerInterval: connection.preis === minPrice
        })
      })
    })

    // Erstelle vollständigen Cache-Eintrag mit ALLEN Verbindungen (mit Markierung)
    const fullResult = {
      [tag]: {
        preis: 0, // Wird später gesetzt
        info: "",
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
        allIntervals: finalAllIntervals.sort((a, b) => a.preis - b.preis), // Sort by price
      },
    }

    // Cache ALLE Daten (ohne Zeitfilter)
    setCachedResult(cacheKey, fullResult)

    // Jetzt Zeitfilter für aktuelle Anfrage anwenden
    const filteredIntervalle: any[] = []
    for (const iv of data.intervalle) {
      if (Array.isArray(iv.verbindungen)) {
        for (const verbindung of iv.verbindungen) {
          if (verbindung.verbindung && verbindung.verbindung.verbindungsAbschnitte && verbindung.verbindung.verbindungsAbschnitte.length > 0) {
            // Zeitfilter anwenden
            const abschnitte = verbindung.verbindung.verbindungsAbschnitte
            const ersteAbfahrt = abschnitte[0].abfahrtsZeitpunkt
            const letzteAnkunft = abschnitte[abschnitte.length - 1].ankunftsZeitpunkt
            let abfahrtOk = true
            let ankunftOk = true
            if (config.abfahrtAb) {
              abfahrtOk = ersteAbfahrt >= config.abfahrtAb
            }
            if (config.ankunftBis) {
              ankunftOk = letzteAnkunft <= config.ankunftBis
            }
            if (abfahrtOk && ankunftOk) {
              filteredIntervalle.push({ ...iv, verbindungen: [verbindung] })
            }
          }
        }
      }
    }
    console.log(`After time filtering: ${filteredIntervalle.length} intervals`)

    if (filteredIntervalle.length === 0) {
      console.log("No intervals remaining after time filtering")
      const result = { [tag]: { preis: 0, info: "Keine Verbindungen im gewählten Zeitraum!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "", allIntervals: [] } }
      return { result, wasApiCall: true }
    }

    // Verwende die bereits verarbeiteten und markierten Intervalle
    // Filtere diese nach Zeit
    const timeFilteredIntervals = finalAllIntervals.filter(interval => {
      const ersteAbfahrt = interval.abfahrtsZeitpunkt
      const letzteAnkunft = interval.ankunftsZeitpunkt
      let abfahrtOk = true
      let ankunftOk = true
      if (config.abfahrtAb) {
        abfahrtOk = ersteAbfahrt >= config.abfahrtAb
      }
      if (config.ankunftBis) {
        ankunftOk = letzteAnkunft <= config.ankunftBis
      }
      return abfahrtOk && ankunftOk
    })

    if (timeFilteredIntervals.length === 0) {
      console.log("No intervals remaining after time filtering")
      const result = { [tag]: { preis: 0, info: "Keine Verbindungen im gewählten Zeitraum!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "", allIntervals: [] } }
      return { result, wasApiCall: true }
    }

    // Finde günstigste Verbindung für Bestpreis-Anzeige
    const bestPrice = Math.min(...timeFilteredIntervals.map(iv => iv.preis))
    const bestInterval = timeFilteredIntervals.find(interval => interval.preis === bestPrice)
    const sortedTimeFilteredIntervals = timeFilteredIntervals.sort((a, b) => a.preis - b.preis)

    console.log(`Best price for ${tag}: ${bestPrice}€`)

    const result = {
      [tag]: {
        preis: bestPrice,
        info: bestInterval?.info || "",
        abfahrtsZeitpunkt: bestInterval?.abfahrtsZeitpunkt || "",
        ankunftsZeitpunkt: bestInterval?.ankunftsZeitpunkt || "",
        allIntervals: sortedTimeFilteredIntervals, // Verwende die zeitgefilterten und markierten Intervalle
      },
    }

    return { result, wasApiCall: true }
  } catch (error) {
    // Spezielle Behandlung für cancelled sessions
    if (error instanceof Error && error.message.includes('was cancelled')) {
      console.log(`ℹ️ Search for ${tag} was cancelled by user`)
      const result = {
        [tag]: {
          preis: 0,
          info: "Search cancelled",
          abfahrtsZeitpunkt: "",
          ankunftsZeitpunkt: "",
        },
      }
      return { result, wasApiCall: true }
    }
    
    console.error(`❌ API error for ${tag}:`, error instanceof Error ? error.message : error)
    const result = {
      [tag]: {
        preis: 0,
        info: `API Error: ${error instanceof Error ? error.message : "Unknown"}`,
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
      },
    }
    return { result, wasApiCall: true }
  }
}