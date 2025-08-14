"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface IntervalData {
  preis: number
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  abfahrtsOrt: string
  ankunftsOrt: string
  info: string
}

interface PriceData {
  preis: number
  info: string
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  allIntervals?: IntervalData[]
}

interface PriceResults {
  [date: string]: PriceData
}

interface PriceCalendarProps {
  results: PriceResults
  onDayClick: (date: string, data: PriceData) => void
  startStation?: { name: string; id: string }
  zielStation?: { name: string; id: string }
  searchParams?: any
  timeFilter?: {
    abfahrtAb?: string
    ankunftBis?: string
  }
}

export function PriceCalendar({ results, onDayClick, timeFilter }: PriceCalendarProps) {
  const today = new Date()
  const resultDates = Object.keys(results).filter(key => key !== '_meta').sort()
  
  if (resultDates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Keine Suchergebnisse verfügbar. Bitte starten Sie eine neue Suche.
      </div>
    )
  }

  const minPrice = Math.min(...resultDates.map(date => results[date].preis).filter(p => p > 0))
  const maxPrice = Math.max(...resultDates.map(date => results[date].preis))

  const getColorForPrice = (price: number) => {
    if (price === 0) return "bg-gray-200 border-gray-300 text-gray-500"
    
    const ratio = (price - minPrice) / (maxPrice - minPrice)
    if (ratio <= 0.33) return "bg-green-100 border-green-300 text-green-800"
    if (ratio <= 0.66) return "bg-yellow-100 border-yellow-300 text-yellow-800"
    return "bg-red-100 border-red-300 text-red-800"
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Preiskalender</h2>
        {(timeFilter?.abfahrtAb || timeFilter?.ankunftBis) && (
          <div className="text-sm text-gray-600 mb-4 p-2 bg-blue-50 rounded">
            <strong>Zeitfilter aktiv:</strong>
            {timeFilter.abfahrtAb && ` Abfahrt ab ${timeFilter.abfahrtAb}`}
            {timeFilter.abfahrtAb && timeFilter.ankunftBis && ` •`}
            {timeFilter.ankunftBis && ` Ankunft bis ${timeFilter.ankunftBis}`}
          </div>
        )}
        <p className="text-gray-600">Klicken Sie auf einen Tag, um Details zu sehen.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {resultDates.map((dateKey) => {
          const dateObj = new Date(dateKey)
          const priceData = results[dateKey]
          const isPastDay = dateObj < new Date(today.toDateString())
          const colorClass = getColorForPrice(priceData.preis)
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

          return (
            <div
              key={dateKey}
              className={`
                p-3 text-center cursor-pointer transition-all duration-200 hover:scale-105 border-2
                ${isPastDay ? 'opacity-50 bg-gray-100 border-gray-200' : ''}
                ${!isPastDay ? 'hover:shadow-lg' : ''}
                ${colorClass}
              `}
              onClick={() => {
                if (!isPastDay) {
                  console.log('Calendar day clicked:', dateKey, results[dateKey])
                  onDayClick(dateKey, results[dateKey])
                }
              }}
            >
              <div className="font-medium text-sm mb-1">
                {dateObj.toLocaleDateString("de-DE", { 
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit"
                })}
              </div>
              {isWeekend && <Badge variant="secondary" className="text-xs mb-1">WE</Badge>}
              
              {priceData.preis > 0 ? (
                <>
                  <div className="text-lg font-bold mb-1">
                    {priceData.preis}€
                  </div>
                  <div className="text-xs text-gray-600">
                    {priceData.allIntervals?.length || 1} Verbindung{(priceData.allIntervals?.length || 1) !== 1 ? 'en' : ''}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Keine<br/>Verbindungen
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Preislegende</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Günstig ({minPrice}€)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Mittel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>Teuer ({maxPrice}€)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
            <span>Keine Verbindungen</span>
          </div>
        </div>
      </div>
    </div>
  )
}