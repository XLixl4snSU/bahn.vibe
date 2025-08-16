"use client"

import React, { useState, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeftRight, Train, User, Percent, Shuffle, ArrowRight, Ticket, Zap, MapPin, Calendar, CalendarCheck, Clock } from "lucide-react"

interface SearchParams {
  start?: string
  ziel?: string
  reisezeitraumAb?: string
  alter?: string
  ermaessigungArt?: string
  ermaessigungKlasse?: string
  klasse?: string
  schnelleVerbindungen?: string
  nurDeutschlandTicketVerbindungen?: string
  maximaleUmstiege?: string
  dayLimit?: string
  reisezeitraumBis?: string
  abfahrtAb?: string
  ankunftBis?: string
  tage?: string // JSON-String mit Array der gewünschten Tage
}

interface TrainSearchFormProps {
  searchParams: SearchParams
}

export function TrainSearchForm({ searchParams }: TrainSearchFormProps) {
  const [start, setStart] = useState(searchParams.start || "")
  const [ziel, setZiel] = useState(searchParams.ziel || "")
  const [reisezeitraumAb, setReisezeitraumAb] = useState(searchParams.reisezeitraumAb || new Date().toISOString().split("T")[0])
  const [alter, setAlter] = useState(searchParams.alter || "ERWACHSENER")
  const [ermaessigungArt, setErmaessigungArt] = useState(searchParams.ermaessigungArt || "KEINE_ERMAESSIGUNG")
  const [ermaessigungKlasse, setErmaessigungKlasse] = useState(searchParams.ermaessigungKlasse || "KLASSENLOS")
  const [klasse, setKlasse] = useState(searchParams.klasse || "KLASSE_2")
  const [schnelleVerbindungen, setSchnelleVerbindungen] = useState(
    searchParams.schnelleVerbindungen === undefined || searchParams.schnelleVerbindungen === "1"
  )
  const [nurDeutschlandTicket, setNurDeutschlandTicket] = useState(
    searchParams.nurDeutschlandTicketVerbindungen === "1",
  )
  const [abfahrtAb, setAbfahrtAb] = useState(searchParams.abfahrtAb || "")
  const [ankunftBis, setAnkunftBis] = useState(searchParams.ankunftBis || "")
  // Direktverbindungen-Checkbox initialisieren, wenn maximaleUmstiege 0 ist
  const [nurDirektverbindungen, setNurDirektverbindungen] = useState(
    searchParams.maximaleUmstiege === "0"
  )
  const [maximaleUmstiege, setMaximaleUmstiege] = useState(
    searchParams.maximaleUmstiege !== undefined
      ? searchParams.maximaleUmstiege
      : "3"
  )
  const [dayLimit, setDayLimit] = useState(searchParams.dayLimit || "3")
  const [reisezeitraumBis, setReisezeitraumBis] = useState(() => {
    if (searchParams.reisezeitraumBis) return searchParams.reisezeitraumBis
    const ab = new Date(reisezeitraumAb)
    ab.setDate(ab.getDate() + 2)
    return ab.toISOString().split("T")[0]
  })

  const switchStations = () => {
    const temp = start
    setStart(ziel)
    setZiel(temp)
  }

  // Wochentage für Auswahl
  const weekdayLabels = [
    { label: "Mo", value: 1 },
    { label: "Di", value: 2 },
    { label: "Mi", value: 3 },
    { label: "Do", value: 4 },
    { label: "Fr", value: 5 },
    { label: "Sa", value: 6 },
    { label: "So", value: 0 },
  ]

  // State für ausgewählte Wochentage (Standard: alle true, oder aus URL-Parametern)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(() => {
    // Versuche aus übergebenen tage-Parametern die Wochentage zu ermitteln
    if (searchParams.tage) {
      try {
        const existingDates = JSON.parse(searchParams.tage) as string[]
        const weekdays = new Set<number>()
        existingDates.forEach(dateStr => {
          const date = new Date(dateStr)
          weekdays.add(date.getDay())
        })
        return Array.from(weekdays)
      } catch {
        // Fallback zu allen Tagen bei Parse-Fehlern
      }
    }
    return [1,2,3,4,5,6,0] // Standard: alle Wochentage
  })

  // Hilfsfunktion: Alle gewünschten Tage im Zeitraum berechnen (limitiert auf max. 30 Tage)
  const selectedDates = useMemo(() => {
    const dates: string[] = []
    const start = new Date(reisezeitraumAb)
    const end = new Date(reisezeitraumBis)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (selectedWeekdays.includes(d.getDay())) {
        dates.push(d.toISOString().split("T")[0])
        // Limitiere auf maximal 30 Tage
        if (dates.length >= 30) break
      }
    }
    return dates
  }, [reisezeitraumAb, reisezeitraumBis, selectedWeekdays])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (start) params.set("start", start)
    if (ziel) params.set("ziel", ziel)
    if (reisezeitraumAb) params.set("reisezeitraumAb", reisezeitraumAb)
    if (reisezeitraumBis) params.set("reisezeitraumBis", reisezeitraumBis)
    if (alter) params.set("alter", alter)
    params.set("ermaessigungArt", ermaessigungArt)
    params.set("ermaessigungKlasse", ermaessigungKlasse)
    params.set("klasse", klasse)
    if (schnelleVerbindungen) params.set("schnelleVerbindungen", "1")
    if (nurDeutschlandTicket) params.set("nurDeutschlandTicketVerbindungen", "1")
    if (abfahrtAb) params.set("abfahrtAb", abfahrtAb)
    if (ankunftBis) params.set("ankunftBis", ankunftBis)
    if (nurDirektverbindungen) {
      params.set("maximaleUmstiege", "0")
    } else {
      params.set("maximaleUmstiege", maximaleUmstiege)
    }
    const diffTime = new Date(reisezeitraumBis).getTime() - new Date(reisezeitraumAb).getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    params.set("dayLimit", Math.max(1, Math.min(30, diffDays)).toString())
    // Sende die einzelnen Tage als JSON-String
    params.set("tage", JSON.stringify(selectedDates))

    window.location.href = `/?${params.toString()}`
  }

  const handleReset = () => {
    setStart("")
    setZiel("")
    setReisezeitraumAb(new Date().toISOString().split("T")[0])
    setAlter("ERWACHSENER")
    setErmaessigungArt("KEINE_ERMAESSIGUNG")
    setErmaessigungKlasse("KLASSENLOS")
    setKlasse("KLASSE_2")
    setSchnelleVerbindungen(true)
    setNurDeutschlandTicket(false)
    setNurDirektverbindungen(false)
    setMaximaleUmstiege("3")
    setDayLimit("3")
    setAbfahrtAb("")
    setAnkunftBis("")
    setSelectedWeekdays([1,2,3,4,5,6,0]) // Reset zu allen Wochentagen
    // URL bereinigen
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  const handleReisezeitraumAbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReisezeitraumAb(e.target.value)
    // Bis-Datum ggf. anpassen falls es vor dem Ab-Datum liegt
    const ab = new Date(e.target.value)
    const bis = new Date(reisezeitraumBis)
    if (bis < ab) {
      setReisezeitraumBis(e.target.value)
    }
  }

  // Wenn Direktverbindungen aktiviert werden, setze Umstiege auf 0, sonst auf letzten Wert > 0
  const handleDirektverbindungenChange = (checked: boolean) => {
    setNurDirektverbindungen(checked)
    if (checked) {
      setPrevUmstiege(maximaleUmstiege !== "0" ? maximaleUmstiege : prevUmstiege)
      setMaximaleUmstiege("0")
    } else {
      setMaximaleUmstiege(prevUmstiege || "3")
    }
  }

  // Wenn Nutzer das Feld ändert, Checkbox synchronisieren
  const handleMaximaleUmstiegeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMaximaleUmstiege(value)
    if (value === "0") {
      setNurDirektverbindungen(true)
    } else {
      setNurDirektverbindungen(false)
      setPrevUmstiege(value)
    }
  }

  // Wenn maximaleUmstiege sich ändert (z.B. durch URL-Params), Checkbox synchronisieren
  React.useEffect(() => {
    setNurDirektverbindungen(maximaleUmstiege === "0")
  }, [maximaleUmstiege])

  // Merke letzten Nutzerwert für Umstiege (außer 0)
  const [prevUmstiege, setPrevUmstiege] = useState<string>(
    searchParams.maximaleUmstiege && searchParams.maximaleUmstiege !== "0"
      ? searchParams.maximaleUmstiege
      : "3"
  )

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Bestpreissuche</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Abschnitt 1: Reisedaten */}
        <div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">Reisedaten</h3>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-end">
            <div>
              <Label htmlFor="start">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-black" />
                  Von (Startbahnhof)
                </span>
              </Label>
              <Input
                id="start"
                type="text"
                placeholder="München"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col items-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={switchStations}
                className="bg-transparent mt-[30px]"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label htmlFor="ziel">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-black" />
                  Nach (Zielbahnhof)
                </span>
              </Label>
              <Input
                id="ziel"
                type="text"
                placeholder="Berlin"
                value={ziel}
                onChange={(e) => setZiel(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-6 mt-2 items-end">
            <div className="min-w-[140px] flex-1 flex flex-col justify-end">
              <Label htmlFor="reisezeitraumAb">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-black" />
                  Reisezeitraum ab
                </span>
              </Label>
              <Input id="reisezeitraumAb" type="date" value={reisezeitraumAb} onChange={handleReisezeitraumAbChange} className="mt-1 h-10" />
            </div>
            <div className="min-w-[140px] flex-1 flex flex-col justify-end">
              <Label htmlFor="reisezeitraumBis">
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="w-4 h-4 text-black" />
                  Reisezeitraum bis
                </span>
              </Label>
              <Input
                id="reisezeitraumBis"
                type="date"
                min={reisezeitraumAb}
                value={reisezeitraumBis}
                onChange={e => setReisezeitraumBis(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
          </div>
          {/* Zeitfilter - Optional */}
          <div className="flex flex-row flex-wrap gap-6 mt-4">
            <div className="min-w-[140px] flex-1 relative">
              <Label htmlFor="abfahrtAb" className="whitespace-nowrap overflow-hidden text-ellipsis block min-h-[22px]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-black" />
                  Abfahrt ab (optional)
                </span>
              </Label>
              <div className="relative min-h-[40px]">
                <Input 
                  id="abfahrtAb" 
                  type="time" 
                  value={abfahrtAb} 
                  onChange={(e) => setAbfahrtAb(e.target.value)} 
                  className="mt-1 pr-8 h-10 align-middle" 
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center justify-center"
                  style={{width: 20, height: 20, lineHeight: 1}}
                  onClick={() => setAbfahrtAb("")}
                  tabIndex={-1}
                  aria-label="Abfahrt ab zurücksetzen"
                  disabled={!abfahrtAb}
                >
                  {abfahrtAb ? (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{display: 'block'}}><path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ) : (
                    <span style={{width: 16, height: 16, display: 'inline-block'}}></span>
                  )}
                </button>
              </div>
            </div>
            <div className="min-w-[140px] flex-1 relative">
              <Label htmlFor="ankunftBis" className="whitespace-nowrap overflow-hidden text-ellipsis block min-h-[22px]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-black" />
                  Ankunft bis (optional)
                </span>
              </Label>
              <div className="relative min-h-[40px]">
                <Input 
                  id="ankunftBis" 
                  type="time" 
                  value={ankunftBis} 
                  onChange={(e) => setAnkunftBis(e.target.value)} 
                  className="mt-1 pr-8 h-10 align-middle" 
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center justify-center"
                  style={{width: 20, height: 20, lineHeight: 1}}
                  onClick={() => setAnkunftBis("")}
                  tabIndex={-1}
                  aria-label="Ankunft bis zurücksetzen"
                  disabled={!ankunftBis}
                >
                  {ankunftBis ? (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{display: 'block'}}><path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ) : (
                    <span style={{width: 16, height: 16, display: 'inline-block'}}></span>
                  )}
                </button>
              </div>
            </div>
          </div>
          {/* Wochentagsauswahl */}
          <div className="mt-4">
            <Label className="text-sm text-gray-700 mb-2 block">Nur diese Wochentage:</Label>
            <div className="flex flex-row flex-wrap gap-3">
              {weekdayLabels.map(wd => (
                <div key={wd.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weekday-${wd.value}`}
                    checked={selectedWeekdays.includes(wd.value)}
                    onCheckedChange={(checked) => {
                      setSelectedWeekdays(prev =>
                        checked
                          ? [...prev, wd.value]
                          : prev.filter(v => v !== wd.value)
                      )
                    }}
                  />
                  <Label htmlFor={`weekday-${wd.value}`} className="text-sm font-medium">
                    {wd.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          {/* Dynamische Info/Warnbox zu den ausgewählten Tagen */}
          <div className={`mt-3 text-sm p-3 rounded flex items-start gap-2 border ${
            selectedDates.length >= 30
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : selectedDates.length > 10
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-green-700 bg-green-50 border-green-200'
          }`}>
            <span className="mt-0.5 flex-shrink-0 text-xl select-none">
              {selectedDates.length >= 30 ? '⚠️' : selectedDates.length > 10 ? '💡' : '✅'}
            </span>
            <div>
              <span className="font-medium">
                {selectedDates.length} von max. 30 möglichen Tagen werden abgefragt
                {selectedDates.length >= 30 && " (Maximum erreicht)"}
              </span>
              {selectedDates.length >= 30 && (
                <p className="mt-2 font-medium">Es werden nur die ersten 30 Tage abgefragt. Für eine vollständige Suche verkürze bitte den Zeitraum oder wähle weniger Wochentage aus.</p>
              )}
              {selectedDates.length > 10 && selectedDates.length < 30 && (
                <p className="mt-2 font-medium">Je weniger Tage Du abfragst, desto schneller erhältst du Ergebnisse. Wähle nur den Zeitraum, den du wirklich benötigst.</p>
              )}
              {selectedDates.length > 0 && selectedDates.length <= 10 && (
                <p className="mt-2 font-medium">Optimale Auswahl – die Abfrage wird besonders schnell durchgeführt!</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-gray-700 mb-2">Reisende & Ermäßigung</h3>
          <div className="flex flex-row gap-4 flex-wrap md:flex-nowrap">
            <div className="flex-1 min-w-0">
              <Label>
                <span className="inline-flex items-center gap-1">
                  <User className="w-4 h-4 text-black" />
                  Alter
                </span>
              </Label>
              <Select value={alter} onValueChange={setAlter}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Alter wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KIND">Kind (6–14 Jahre)</SelectItem>
                  <SelectItem value="JUGENDLICHER">Jugendlicher (15–26 Jahre)</SelectItem>
                  <SelectItem value="ERWACHSENER">Erwachsener (27–64 Jahre)</SelectItem>
                  <SelectItem value="SENIOR">Senior (ab 65 Jahre)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Label>
                <span className="inline-flex items-center gap-1">
                  <Percent className="w-4 h-4 text-black" />
                  Ermäßigung
                </span>
              </Label>
              <Select
                value={JSON.stringify({ art: ermaessigungArt, klasse: ermaessigungKlasse })}
                onValueChange={(val) => {
                  try {
                    const parsed = JSON.parse(val)
                    setErmaessigungArt(parsed.art)
                    setErmaessigungKlasse(parsed.klasse)
                  } catch {}
                }}
              >
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Ermäßigung wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={JSON.stringify({ art: "KEINE_ERMAESSIGUNG", klasse: "KLASSENLOS" })}>
                    Keine Ermäßigung
                  </SelectItem>
                  <SelectItem value={JSON.stringify({ art: "BAHNCARD25", klasse: "KLASSE_2" })}>
                    BahnCard 25, 2. Klasse
                  </SelectItem>
                  <SelectItem value={JSON.stringify({ art: "BAHNCARD25", klasse: "KLASSE_1" })}>
                    BahnCard 25, 1. Klasse
                  </SelectItem>
                  <SelectItem value={JSON.stringify({ art: "BAHNCARD50", klasse: "KLASSE_2" })}>
                    BahnCard 50, 2. Klasse
                  </SelectItem>
                  <SelectItem value={JSON.stringify({ art: "BAHNCARD50", klasse: "KLASSE_1" })}>
                    BahnCard 50, 1. Klasse
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label>
              <span className="inline-flex items-center gap-1">
                <Train className="w-4 h-4 text-black" />
                Klasse
              </span>
            </Label>
            <RadioGroup value={klasse} onValueChange={setKlasse} className="flex gap-6 mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="KLASSE_1" id="klasse1" />
                <Label htmlFor="klasse1">1. Klasse</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="KLASSE_2" id="klasse2" />
                <Label htmlFor="klasse2">2. Klasse</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-gray-700 mb-2">Optionen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="schnelle"
                checked={schnelleVerbindungen}
                onCheckedChange={checked => setSchnelleVerbindungen(checked === true)}
              />
              <Label htmlFor="schnelle">
                <Zap className="w-4 h-4 mr-1 inline-block text-black" />
                Schnellste Verbindungen bevorzugen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deutschland"
                checked={nurDeutschlandTicket}
                onCheckedChange={checked => setNurDeutschlandTicket(checked === true)}
              />
              <Label htmlFor="deutschland">
                <Ticket className="w-4 h-4 mr-1 inline-block text-black" />
                Nur Deutschland-Ticket-Verbindungen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="direktverbindungen"
                checked={nurDirektverbindungen}
                onCheckedChange={checked => handleDirektverbindungenChange(checked === true)}
              />
              <Label htmlFor="direktverbindungen">
                <ArrowRight className="w-4 h-4 mr-1 inline-block text-black" />
                Nur Direktverbindungen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="umstiege" className="mb-0">
                <span className="inline-flex items-center gap-1"><Shuffle className="w-4 h-4 text-black" />Maximale Umstiege</span>
              </Label>
              <Input
                id="umstiege"
                type="number"
                min="0"
                max="5"
                value={maximaleUmstiege}
                onChange={handleMaximaleUmstiegeChange}
                className={`w-24 ${nurDirektverbindungen ? 'bg-gray-100 text-gray-500' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Bestpreise suchen
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            Zurücksetzen
          </Button>
        </div>
      </form>
    </div>
  )
}
