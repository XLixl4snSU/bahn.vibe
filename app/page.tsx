import { TrainSearchForm } from "@/components/train-search-form"
import { TrainResults } from "@/components/train-results"

interface SearchParams {
  start?: string
  ziel?: string
  abfahrtab?: string
  klasse?: string
  schnelleVerbindungen?: string
  nurDeutschlandTicketVerbindungen?: string
  maximaleUmstiege?: string
  dayLimit?: string
  tage?: string // JSON-String mit Array der gewünschten Tage
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const hasSearch = params.start && params.ziel

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <a href="/" className="text-gray-600 hover:text-retro-gradient">
              sparpreis.guru
            </a>
          </h1>
          <p className="text-gray-600 italic">Finde die günstigste Bahnreise mit einem Preiskalender</p>
        </header>

        <section className="mb-8">
          <TrainSearchForm searchParams={params} />
        </section>

          <section className="mb-8">
            {hasSearch ? (
                <TrainResults searchParams={params} />
            ) : <></>}
          </section>
        </div>
      </div>
  )
}