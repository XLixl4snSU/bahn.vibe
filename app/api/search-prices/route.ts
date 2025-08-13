import { type NextRequest, NextResponse } from "next/server"

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
  }>
}

interface TrainResults {
  [date: string]: TrainResult
}

async function searchBahnhof(search: string): Promise<{ id: string; name: string } | null> {
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
    const id = station.id

    console.log(`Found station: ${station.name} with original ID: ${id}`)

    // DON'T normalize the ID - use it as-is like the working curl
    return { id: id, name: station.name }
  } catch (error) {
    console.error("Error in searchBahnhof:", error)
    return null
  }
}

async function getBestPrice(config: any): Promise<TrainResults | null> {
  const jetzt = config.anfrageZeitpunkt
  // Format date like the working curl: "2025-07-26T08:00:00"
  const datum = new Date(jetzt).toISOString().slice(0, 10) + "T08:00:00"
  const tag = new Date(jetzt).toISOString().split("T")[0]

  console.log(`\n=== Getting best price for ${tag} ===`)

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

      return {
        [tag]: {
          preis: 0,
          info: `API Error ${response.status}: ${errorText.slice(0, 100)}`,
          abfahrtsZeitpunkt: "",
          ankunftsZeitpunkt: "",
        },
      }
    }

    const responseText = await response.text()

    // Check if response contains error message
    if (responseText.includes("Preisauskunft nicht möglich")) {
      console.log("Price info not available for this date")
      return { [tag]: { preis: 0, info: "Kein Bestpreis verfügbar!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" } }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError)
      return {
        [tag]: {
          preis: 0,
          info: "JSON Parse Error",
          abfahrtsZeitpunkt: "",
          ankunftsZeitpunkt: "",
        },
      }
    }

    if (!data || !data.intervalle) {
      console.log("No intervals found in response")
      return { [tag]: { preis: 0, info: "Keine Intervalle gefunden!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" } }
    }

    console.log(`Found ${data.intervalle.length} intervals`)

    const preise: { [key: string]: number } = {}
    const allIntervals: Array<{
      preis: number
      abfahrtsZeitpunkt: string
      ankunftsZeitpunkt: string
      abfahrtsOrt: string
      ankunftsOrt: string
      info: string
    }> = []
    let bestConnection: any = null

    // Process intervals
    for (const iv of data.intervalle) {
      let newPreis = 0

      if (iv.preis && typeof iv.preis === "object" && "betrag" in iv.preis) {
        newPreis = iv.preis.betrag

        if (iv.verbindungen && iv.verbindungen[0] && iv.verbindungen[0].verbindung) {
          const connection = iv.verbindungen[0].verbindung.verbindungsAbschnitte[0]

          if (connection) {
            const abfahrt = new Date(connection.abfahrtsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const ankunft = new Date(connection.ankunftsZeitpunkt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })

            const info = `${abfahrt} ${connection.abfahrtsOrt} -> ${ankunft} ${connection.ankunftsOrt}`
            preise[info + newPreis] = newPreis

            // Store all intervals for detailed view
            allIntervals.push({
              preis: newPreis,
              abfahrtsZeitpunkt: connection.abfahrtsZeitpunkt,
              ankunftsZeitpunkt: connection.ankunftsZeitpunkt,
              abfahrtsOrt: connection.abfahrtsOrt,
              ankunftsOrt: connection.ankunftsOrt,
              info: info,
            })

            // Store the connection for the cheapest price
            if (!bestConnection || newPreis < bestConnection.preis) {
              bestConnection = {
                preis: newPreis,
                connection: connection,
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
      return {
        [tag]: { preis: 0, info: "Keine gültigen Preise gefunden!", abfahrtsZeitpunkt: "", ankunftsZeitpunkt: "" },
      }
    }

    // Find the cheapest price
    const minPreis = Math.min(...Object.values(preise))
    const infoKey = Object.keys(preise).find((key) => preise[key] === minPreis)
    const info = infoKey ? infoKey.replace(minPreis.toString(), "") : ""

    console.log(`Best price for ${tag}: ${minPreis}€`)

    return {
      [tag]: {
        preis: minPreis,
        info,
        abfahrtsZeitpunkt: bestConnection?.connection?.abfahrtsZeitpunkt || "",
        ankunftsZeitpunkt: bestConnection?.connection?.ankunftsZeitpunkt || "",
        allIntervals: allIntervals.sort((a, b) => a.preis - b.preis), // Sort by price
      },
    }
  } catch (error) {
    console.error(`Error in bestpreissuche for ${tag}:`, error)
    return {
      [tag]: {
        preis: 0,
        info: `Fetch Error: ${error instanceof Error ? error.message : "Unknown"}`,
        abfahrtsZeitpunkt: "",
        ankunftsZeitpunkt: "",
      },
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      start,
      ziel,
      abfahrtab,
      alter,
      ermaessigungArt,
      ermaessigungKlasse,
      klasse,
      schnelleVerbindungen,
      nurDeutschlandTicketVerbindungen,
      maximaleUmstiege,
      dayLimit,
    } = body

    console.log("\n🚂 Starting bestpreissuche request")

    if (!start || !ziel) {
      return NextResponse.json({ error: "Start and destination required" }, { status: 400 })
    }

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
    const startDate = new Date(abfahrtab)
    const results: TrainResults = {}
    const currentDate = new Date(startDate)
    const maxDays = Math.min(Math.max(Number.parseInt(dayLimit || "3"), 1), 30) // Between 1 and 30 days

    console.log(`\n🔍 Searching prices for ${maxDays} days starting from ${startDate.toISOString().split("T")[0]}`)

    for (let dayCount = 0; dayCount < maxDays; dayCount++) {
      const timestamp = currentDate.getTime()

      console.log(`Processing day ${dayCount + 1}/${maxDays}: ${currentDate.toISOString().split("T")[0]}`)

      const dayResult = await getBestPrice({
        abfahrtsHalt: startStation.id,
        ankunftsHalt: zielStation.id,
        anfrageZeitpunkt: timestamp,
        alter,
        ermaessigungArt,
        ermaessigungKlasse,
        klasse,
        maximaleUmstiege: Number.parseInt(maximaleUmstiege || "0"),
        schnelleVerbindungen: schnelleVerbindungen === true || schnelleVerbindungen === "1",
        nurDeutschlandTicketVerbindungen:
          nurDeutschlandTicketVerbindungen === true || nurDeutschlandTicketVerbindungen === "1",
      })

      if (dayResult) {
        Object.assign(results, dayResult)
        console.log(`Day ${currentDate.toISOString().split("T")[0]} result:`, Object.values(dayResult)[0])
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))

      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`\n✅ Bestpreissuche completed: ${Object.keys(results).length} days processed`)

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
        },
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
