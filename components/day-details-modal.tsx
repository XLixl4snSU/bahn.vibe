"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, ArrowRight, Euro, Calendar, Train, TrendingUp, GraduationCap, User, Percent, Shuffle } from "lucide-react"

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

interface DayDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  date: string | null
  data: PriceData | null
  startStation?: { name: string; id: string }
  zielStation?: { name: string; id: string }
  searchParams?: any
}

const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]

function getPersonCode(alter: string) {
  switch (alter) {
    case "ERWACHSENER": return "13"
    case "KIND": return "11"
    case "SENIOR": return "12"
    case "JUGENDLICHER": return "9"
    default: return "13"  // Default to ERWACHSENER if unknown
  }
}

function getDiscountCode(ermaessigungArt: string, ermaessigungKlasse: string) {
  if (ermaessigungArt === "BAHNCARD25" && ermaessigungKlasse === "KLASSE_1") return "17"
  if (ermaessigungArt === "BAHNCARD25" && ermaessigungKlasse === "KLASSE_2") return "17"
  if (ermaessigungArt === "BAHNCARD50" && ermaessigungKlasse === "KLASSE_1") return "23"
  if (ermaessigungArt === "BAHNCARD50" && ermaessigungKlasse === "KLASSE_2") return "23"
  if (ermaessigungArt === "KEINE_ERMAESSIGUNG") return "16"
  return "0"
}

function getRParam(alter: string, ermaessigungArt: string, ermaessigungKlasse: string, klasse: string) {
  // personCode
  let personCode = getPersonCode(alter)
  // discountCode
  let discountCode = getDiscountCode(ermaessigungArt, ermaessigungKlasse)
  // r-Param
  return `${personCode}:${discountCode}:${klasse}:1`
}

function createBookingLink(
  abfahrtsZeitpunkt: string,
  startStationId: string,
  zielStationId: string,
  klasse: string,
  maximaleUmstiege: string,
  alter: string,
  ermaessigungArt: string,
  ermaessigungKlasse: string,
): string {
  if (!abfahrtsZeitpunkt || !startStationId || !zielStationId) {
    return ""
  }

  const klasseParam = klasse === "KLASSE_1" ? "1" : "2"
  const direktverbindung = maximaleUmstiege === "0" ? "true" : "false"
  const departureTime = encodeURIComponent(abfahrtsZeitpunkt)

  const rParam = getRParam(alter, ermaessigungArt, ermaessigungKlasse, klasse)

  return `https://www.bahn.de/buchung/fahrplan/suche#sts=true&kl=${klasseParam}&r=${rParam}&hd=${departureTime}&soid=${encodeURIComponent(startStationId)}&zoid=${encodeURIComponent(zielStationId)}&bp=true&d=${direktverbindung}`
}

function getAlterLabel(alter: string | undefined) {
  switch (alter) {
    case "KIND": return "Kind (6–14 Jahre)"
    case "JUGENDLICHER": return "Jugendlicher (15–26 Jahre)"
    case "ERWACHSENER": return "Erwachsener (27–64 Jahre)"
    case "SENIOR": return "Senior (ab 65 Jahre)"
    default: return alter || "-"
  }
}

export function DayDetailsModal({
  isOpen,
  onClose,
  date,
  data,
  startStation,
  zielStation,
  searchParams,
}: DayDetailsModalProps) {
  if (!date || !data) return null

  const dateObj = new Date(date)
  const formattedDate = dateObj.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const intervals = data.allIntervals || []

  // Check if this is a weekend
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
  
  // Check if there are multiple intervals
  const hasMultipleIntervals = intervals.length > 1

  const calculateDuration = (departure: string, arrival: string) => {
    const dep = new Date(departure)
    const arr = new Date(arrival)
    const duration = arr.getTime() - dep.getTime()
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}min`
  }

  const getIntervalPriceColor = (price: number) => {
    const minIntervalPrice = Math.min(...intervals.map((i) => i.preis))
    const maxIntervalPrice = Math.max(...intervals.map((i) => i.preis))

    if (price === minIntervalPrice) return "text-green-600 bg-green-50"
    if (price === maxIntervalPrice) return "text-red-600 bg-red-50"
    return "text-orange-600 bg-orange-50"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5 text-blue-600" />
            {formattedDate}
            {isWeekend && <Badge variant="secondary">Wochenende</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Best Price Overview */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Bestpreis für diesen Tag</h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-green-600" />
                <span className="text-3xl font-bold text-green-600">{data.preis}€</span>
              </div>

              <div className="text-sm text-gray-600">
                <div className="flex flex-wrap gap-4 items-center text-sm text-gray-600 mt-2">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{getAlterLabel(searchParams.alter)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Train className="w-4 h-4" />
                    <span>{searchParams.klasse === "KLASSE_1" ? "1. Klasse" : "2. Klasse"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Percent className="w-4 h-4" />
                    <span>{searchParams.ermaessigungArt === "KEINE_ERMAESSIGUNG" ? "Keine Ermäßigung" : `${searchParams.ermaessigungArt === "BAHNCARD25" ? "BahnCard 25" : searchParams.ermaessigungArt === "BAHNCARD50" ? "BahnCard 50" : searchParams.ermaessigungArt}, ${searchParams.ermaessigungKlasse === "KLASSE_1" ? "1. Klasse" : "2. Klasse"}`}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shuffle className="w-4 h-4" />
                    <span>Max. Umstiege: {searchParams.maximaleUmstiege || "0"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* All Available Connections */}
          {hasMultipleIntervals && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <Train className="h-4 w-4" />
                Alle verfügbaren Verbindungen ({intervals.length})
              </h3>

              <div className="space-y-3 overflow-y-auto">
                {intervals.map((interval: any, index: number) => {
                  const bookingLink =
                    startStation && zielStation
                      ? createBookingLink(
                          interval.abfahrtsZeitpunkt,
                          startStation.id,
                          zielStation.id,
                          searchParams.klasse || "KLASSE_2",
                          searchParams.maximaleUmstiege || "0",
                          searchParams.alter || "ERWACHSENER",
                          searchParams.ermaessigungArt || "KEINE_ERMAESSIGUNG",
                          searchParams.ermaessigungKlasse || "KLASSENLOS",
                        )
                      : null

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded border-l-4 ${
                        interval.preis === data.preis ? "border-green-500 bg-green-50" : "border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold text-lg px-2 py-1 rounded ${getIntervalPriceColor(interval.preis)}`}
                          >
                            {interval.preis}€
                          </span>
                          {interval.preis === data.preis && (
                            <Badge className="bg-green-100 text-green-800">Bestpreis</Badge>
                          )}
                        </div>

                        {bookingLink && (
                          <Button
                            size="sm"
                            onClick={() => window.open(bookingLink, "_blank")}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Buchen
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-gray-600 mb-1">Abfahrt</div>
                          <div className="font-medium">
                            {new Date(interval.abfahrtsZeitpunkt).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-xs text-gray-500">{interval.abfahrtsOrt}</div>
                        </div>

                        <div>
                          <div className="text-gray-600 mb-1">Ankunft</div>
                          <div className="font-medium">
                            {new Date(interval.ankunftsZeitpunkt).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-xs text-gray-500">{interval.ankunftsOrt}</div>
                        </div>

                        <div>
                          <div className="text-gray-600 mb-1">Reisedauer</div>
                          <div className="font-medium">
                            {calculateDuration(interval.abfahrtsZeitpunkt, interval.ankunftsZeitpunkt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Route Information */}
          {startStation && zielStation && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Strecke
              </h3>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{startStation.name}</span>
                </div>

                <ArrowRight className="h-4 w-4 text-gray-400" />

                <div className="flex items-center gap-2">
                  <span className="font-medium">{zielStation.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* Price Statistics */}
          {hasMultipleIntervals && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Preisstatistik für diesen Tag
              </h3>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Günstigste Verbindung</div>
                  <div className="font-bold text-green-600">{Math.min(...intervals.map((i: any) => i.preis))}€</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Durchschnitt</div>
                  <div className="font-bold text-blue-600">
                    {Math.round(intervals.reduce((sum: number, i: any) => sum + i.preis, 0) / intervals.length)}€
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Teuerste Verbindung</div>
                  <div className="font-bold text-red-600">{Math.max(...intervals.map((i: any) => i.preis))}€</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {data.abfahrtsZeitpunkt && startStation && zielStation && (
              <Button
                onClick={() => {
                  const bookingLink = createBookingLink(
                    data.abfahrtsZeitpunkt,
                    startStation.id,
                    zielStation.id,
                    searchParams.klasse || "KLASSE_2",
                    searchParams.maximaleUmstiege || "0",
                    searchParams.alter || "ERWACHSENER",
                    searchParams.ermaessigungArt || "KEINE_ERMAESSIGUNG",
                    searchParams.ermaessigungKlasse || "KLASSENLOS",
                  )
                  if (bookingLink) {
                    window.open(bookingLink, "_blank")
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Train className="h-4 w-4 mr-2" />
                Bestpreis buchen ({data.preis}€)
              </Button>
            )}

            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
          </div>

          {/* Booking Info */}
          <div className="text-xs text-gray-500 text-center bg-blue-50 p-3 rounded">
            💡 Sie werden zur offiziellen Deutsche Bahn Website weitergeleitet. Alle Suchparameter werden automatisch
            übertragen. {hasMultipleIntervals && `${intervals.length} verschiedene Verbindungen verfügbar.`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
