"use client"

import { useState, useEffect } from "react"
import { PriceCalendar } from "./price-calendar"
import { LoadingSpinner } from "./loading-spinner"
import { DayDetailsModal } from "./day-details-modal"
import { SearchProgress } from "./search-progress"

interface SearchParams {
  start?: string
  ziel?: string
  reisezeitraumAb?: string
  reisezeitraumBis?: string
  alter?: string
  ermaessigungArt?: string
  ermaessigungKlasse?: string
  klasse?: string
  schnelleVerbindungen?: string
  nurDeutschlandTicketVerbindungen?: string
  maximaleUmstiege?: string
  dayLimit?: string
  abfahrtAb?: string
  ankunftBis?: string
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

interface MetaData {
  startStation: { name: string; id: string }
  zielStation: { name: string; id: string }
  sessionId?: string
  searchParams?: {
    klasse?: string
    maximaleUmstiege?: string
    schnelleVerbindungen?: string | boolean
    nurDeutschlandTicketVerbindungen?: string | boolean
    abfahrtAb?: string
    ankunftBis?: string
  }
}

interface PriceResults {
  [date: string]: PriceData
}

export function TrainResults({ searchParams }: TrainResultsProps) {
  const [priceResults, setPriceResults] = useState<PriceResults>({})
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedData, setSelectedData] = useState<PriceData | null>(null)

  // Generate sessionId when search starts
  const generateSessionId = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID()
    }
    // Fallback für ältere Browser
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  const validPriceResults = Object.entries(priceResults).filter(([key]) => key !== "_meta") as [string, PriceData][]
  const _meta = (priceResults as any)._meta as MetaData | undefined
  const startStation = _meta?.startStation
  const zielStation = _meta?.zielStation

  // Create a unique key for the current search to prevent duplicate requests
  const currentSearchKey = JSON.stringify({
    start: searchParams.start,
    ziel: searchParams.ziel,
    reisezeitraumAb: searchParams.reisezeitraumAb,
    reisezeitraumBis: searchParams.reisezeitraumBis,
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
    if (!searchParams.start || !searchParams.ziel || currentSearchKey === "") {
      return
    }

    const searchPrices = async () => {
      setLoading(true)
      setPriceResults({})
      
      // Generiere sessionId sofort im Frontend
      const newSessionId = generateSessionId()
      setSessionId(newSessionId)

      try {
        const response = await fetch("/api/search-prices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: newSessionId,
            start: searchParams.start,
            ziel: searchParams.ziel,
            reisezeitraumAb: searchParams.reisezeitraumAb || new Date().toISOString().split("T")[0],
            reisezeitraumBis: searchParams.reisezeitraumBis,
            alter: searchParams.alter || "ERWACHSENER",
            ermaessigungArt: searchParams.ermaessigungArt || "KEINE_ERMAESSIGUNG",
            ermaessigungKlasse: searchParams.ermaessigungKlasse || "KLASSENLOS",
            klasse: searchParams.klasse || "KLASSE_2",
            schnelleVerbindungen: searchParams.schnelleVerbindungen === "1",
            nurDeutschlandTicketVerbindungen: searchParams.nurDeutschlandTicketVerbindungen === "1",
            maximaleUmstiege: Number.parseInt(searchParams.maximaleUmstiege || "0"),
            dayLimit: Number.parseInt(searchParams.dayLimit || "3"),
            abfahrtAb: searchParams.abfahrtAb,
            ankunftBis: searchParams.ankunftBis,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || `HTTP ${response.status}: Bestpreissuche fehlgeschlagen`)
        }

        const data = await response.json()
        setPriceResults(data)
        setSelectedDay(null)
      } catch (err) {
        console.error("Error in bestpreissuche:", err)
      } finally {
        setLoading(false)
        setSessionId(null)
      }
    }

    searchPrices()
  }, [
    currentSearchKey,
    searchParams.start,
    searchParams.ziel,
    searchParams.reisezeitraumAb,
    searchParams.reisezeitraumBis,
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
      <SearchProgress 
        sessionId={sessionId} 
        searchParams={{
          start: searchParams.start,
          ziel: searchParams.ziel,
          dayLimit: searchParams.dayLimit
        }}
      />
    )
  }

  // Show no results state
  if (!validPriceResults || validPriceResults.length === 0) {
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
  const prices = validPriceResults
      .map(([, r]) => r.preis)
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
            📊 Preisübersicht ({validPriceResults.length} Tage)
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
              onDayClick={(date, data) => {
                setSelectedDay(date)
                setSelectedData(data)
              }}
              startStation={startStation}
              zielStation={zielStation}
              searchParams={searchParams}
          />
        </div>

        {/* Day Details Modal */}
        <DayDetailsModal
            isOpen={!!selectedDay}
            onClose={() => {
              setSelectedDay(null)
              setSelectedData(null)
            }}
            date={selectedDay}
            data={selectedData}
            startStation={startStation}
            zielStation={zielStation}
            searchParams={searchParams}
        />
      </div>
  )
}