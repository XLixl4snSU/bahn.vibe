"use client"

import { useState, useEffect } from "react"
import { PriceCalendar } from "./price-calendar"
import { LoadingSpinner } from "./loading-spinner"

interface SearchParams {
  start?: string
  ziel?: string
  abfahrtab?: string
  alter?: string
  klasse?: string
  schnelleVerbindungen?: string
  nurDeutschlandTicketVerbindungen?: string
  maximaleUmstiege?: string
  dayLimit?: string
  ermaessigungArt?: string
  ermaessigungKlasse?: string
}

interface TrainResultsProps {
  searchParams: SearchParams
}

interface PriceData {
  preis: number
  info: string
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
}

interface SearchResults {
  [date: string]: PriceData
  _meta?: {
    startStation: { name: string; id: string }
    zielStation: { name: string; id: string }
  }
}

export function TrainResults({ searchParams }: TrainResultsProps) {
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number>(0)
  const [lastSearchKey, setLastSearchKey] = useState<string>("")

  // Create a unique key for the current search to prevent duplicate requests
  const currentSearchKey = JSON.stringify({
    start: searchParams.start,
    ziel: searchParams.ziel,
    abfahrtab: searchParams.abfahrtab,
    ermaessigungArt: searchParams.ermaessigungArt,
    ermaessigungKlasse: searchParams.ermaessigungKlasse,
    alter: searchParams.alter,
    klasse: searchParams.klasse,
    schnelleVerbindungen: searchParams.schnelleVerbindungen,
    nurDeutschlandTicketVerbindungen: searchParams.nurDeutschlandTicketVerbindungen,
    maximaleUmstiege: searchParams.maximaleUmstiege,
    dayLimit: searchParams.dayLimit,
  })

  useEffect(() => {
    // Only search if we have required params and this is a new search
    if (!searchParams.start || !searchParams.ziel || currentSearchKey === lastSearchKey) {
      return
    }

    const searchPrices = async () => {
      setLoading(true)
      setError(null)
      setResults(null)

      const startTime = Date.now()

      try {
        // Get the base URL for API calls
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")

        const response = await fetch(`${baseUrl}/api/search-prices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: searchParams.start,
            ziel: searchParams.ziel,
            abfahrtab: searchParams.abfahrtab || new Date().toISOString().split("T")[0],
            alter: searchParams.alter || "ERWACHSENER",
            ermaessigungArt: searchParams.ermaessigungArt || "KEINE_ERMAESSIGUNG",
            ermaessigungKlasse: searchParams.ermaessigungKlasse || "KLASSENLOS",
            klasse: searchParams.klasse || "KLASSE_2",
            schnelleVerbindungen: searchParams.schnelleVerbindungen === "1",
            nurDeutschlandTicketVerbindungen: searchParams.nurDeutschlandTicketVerbindungen === "1",
            maximaleUmstiege: Number.parseInt(searchParams.maximaleUmstiege || "0"),
            dayLimit: Number.parseInt(searchParams.dayLimit || "3"),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || `HTTP ${response.status}: Bestpreissuche fehlgeschlagen`)
        }

        const data = await response.json()
        const endTime = Date.now()

        setResults(data)
        setExecutionTime(Math.round((endTime - startTime) / 1000))
        setLastSearchKey(currentSearchKey) // Mark this search as completed
      } catch (err) {
        console.error("Error in bestpreissuche:", err)
        setError(err instanceof Error ? err.message : "Unbekannter Fehler")
      } finally {
        setLoading(false)
      }
    }

    searchPrices()
  }, [
    currentSearchKey,
    lastSearchKey,
    searchParams.start,
    searchParams.ziel,
    searchParams.abfahrtab,
    searchParams.alter,
    searchParams.klasse,
    searchParams.schnelleVerbindungen,
    searchParams.nurDeutschlandTicketVerbindungen,
    searchParams.maximaleUmstiege,
    searchParams.dayLimit,
    searchParams.ermaessigungArt,
    searchParams.ermaessigungKlasse,
  ])

  // Show nothing if no search params
  if (!searchParams.start || !searchParams.ziel) {
    return null
  }

  // Show loading state
  if (loading) {
    return (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">🔍 Suche läuft...</h3>
            <p className="text-sm text-blue-600">
              Durchsuche {searchParams.dayLimit || "3"} Tage für die beste Preise zwischen {searchParams.start} und{" "}
              {searchParams.ziel}
            </p>
          </div>
          <LoadingSpinner />
        </div>
    )
  }

  // Show error state
  if (error) {
    return (
        <div className="text-center py-8">
          <p className="text-red-600 font-bold">Fehler bei der Bestpreissuche - Backend not responding</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-2">
            Bitte versuchen Sie es später erneut oder überprüfen Sie Ihre Internetverbindung.
          </p>
          <button
              onClick={() => {
                setLastSearchKey("") // Reset to allow retry
                setError(null)
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
    )
  }

  // Show no results state
  if (!results) {
    return null
  }

  // Extract metadata and results
  const { _meta, ...priceResults } = results
  const startStation = _meta?.startStation
  const zielStation = _meta?.zielStation

  if (!priceResults || Object.keys(priceResults).length === 0) {
    return (
        <div className="text-center py-8">
          <p className="text-red-600 font-medium">Keine Bestpreise gefunden</p>
          <p className="text-gray-600 text-sm mt-2">
            Bitte überprüfen Sie Ihre Bahnhofsnamen und versuchen Sie es erneut.
          </p>
        </div>
    )
  }

  // Find min and max prices for summary
  const prices = Object.values(priceResults)
      .map((r) => r.preis)
      .filter((p) => p > 0)

  if (prices.length === 0) {
    return (
        <div className="text-center py-8">
          <p className="text-orange-600 font-medium">Keine Preise verfügbar</p>
          <p className="text-gray-600 text-sm mt-2">Für den gewählten Zeitraum sind keine Bestpreise verfügbar.</p>
        </div>
    )
  }

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)

  return (
      <div className="space-y-6">
        {/* Quick Summary */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">
            📊 Preisübersicht ({Object.keys(priceResults).length} Tage)
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-green-600 font-bold text-lg">{minPrice}€</div>
              <div className="text-gray-600">Günstigster</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600 font-bold text-lg">{avgPrice}€</div>
              <div className="text-gray-600">Durchschnitt</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 font-bold text-lg">{maxPrice}€</div>
              <div className="text-gray-600">Teuerster</div>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            📅 Preiskalender
            <span className="text-sm font-normal text-gray-500">(Klicken zum Buchen)</span>
          </h3>
          <PriceCalendar
              results={priceResults}
              startStation={startStation}
              zielStation={zielStation}
              searchParams={{
                klasse: searchParams.klasse,
                maximaleUmstiege: searchParams.maximaleUmstiege,
                alter: searchParams.alter,
                ermaessigungArt: searchParams.ermaessigungArt,
                ermaessigungKlasse: searchParams.ermaessigungKlasse,
              }}
          />
        </div>

        {/* Processing Info */}
        <div className="text-center p-3 bg-gray-100 rounded text-sm text-gray-600">
          ✅ Bestpreissuche abgeschlossen in {executionTime}s • {Object.keys(priceResults).length} Tage durchsucht
        </div>
      </div>
  )
}
