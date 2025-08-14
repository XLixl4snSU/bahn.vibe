"use client"

import React, { useState } from "react"

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

  const berechneteTage = Math.max(1, Math.min(30, Math.ceil((new Date(reisezeitraumBis).getTime() - new Date(reisezeitraumAb).getTime()) / (1000*60*60*24) + 1)))

  const switchStations = () => {
    const temp = start
    setStart(ziel)
    setZiel(temp)
  }

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
    // URL bereinigen
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  const handleReisezeitraumAbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReisezeitraumAb(e.target.value)
    // Bis-Datum ggf. anpassen
    const ab = new Date(e.target.value)
    const bis = new Date(reisezeitraumBis)
    const maxBis = new Date(e.target.value)
    maxBis.setDate(maxBis.getDate() + 30)
    if (bis < ab) {
      setReisezeitraumBis(e.target.value)
    } else if (bis > maxBis) {
      setReisezeitraumBis(maxBis.toISOString().split("T")[0])
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
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
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
          <div className="flex flex-row flex-wrap gap-4 mt-2 items-end">
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
                  Reisezeitraum bis (max. 30 Tage nach Start)
                </span>
              </Label>
              <Input
                id="reisezeitraumBis"
                type="date"
                min={reisezeitraumAb}
                max={(() => {
                  const ab = new Date(reisezeitraumAb)
                  ab.setDate(ab.getDate() + 30)
                  return ab.toISOString().split("T")[0]
                })()}
                value={reisezeitraumBis}
                onChange={e => setReisezeitraumBis(e.target.value)}
                className="mt-1 h-10"
              />
            </div>
          </div>
          {/* Zeitfilter - Optional */}
          <div className="flex flex-row flex-wrap gap-4 mt-4">
            <div className="min-w-[140px] flex-1">
              <Label htmlFor="abfahrtAb">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-black" />
                  Abfahrt ab (optional)
                </span>
              </Label>
              <Input 
                id="abfahrtAb" 
                type="time" 
                value={abfahrtAb} 
                onChange={(e) => setAbfahrtAb(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div className="min-w-[140px] flex-1">
              <Label htmlFor="ankunftBis">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-black" />
                  Ankunft bis (optional)
                </span>
              </Label>
              <Input 
                id="ankunftBis" 
                type="time" 
                value={ankunftBis} 
                onChange={(e) => setAnkunftBis(e.target.value)} 
                className="mt-1" 
              />
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

        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
          <p className="font-medium">ℹ️ Bestpreissuche mit Kalenderansicht</p>
          <p>Findet die günstigsten Preise für {berechneteTage} aufeinanderfolgende Tage.</p>
          <p>
            Verarbeitungszeit: ca. {Math.ceil(berechneteTage * 2)}–{Math.ceil(berechneteTage * 3)} Sekunden.
          </p>
        </div>
      </form>
    </div>
  )
}
