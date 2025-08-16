import { TrainSearchForm } from "@/components/train-search-form"
import { TrainResults } from "@/components/train-results"
import { getAppVersion, getCurrentYear } from "@/lib/app-info"

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
  
  const currentYear = getCurrentYear()
  const appVersion = getAppVersion()

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <a href="/" className="text-gray-600 hover:text-retro-gradient">
              sparpreis.guru
            </a>
          </h1>
          <p className="text-gray-600 italic">Der Sparpreiskalender!</p>
        </header>

        <section className="mb-8">
          <TrainSearchForm searchParams={params} />
        </section>

          <section className="mb-8">
            {hasSearch ? (
                <TrainResults searchParams={params} />
            ) : <></>}
          </section>
        
        {/* Footer */}
        <footer className="mt-16 border-t border-gray-200 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <div>
              © {currentYear} <span className="font-medium text-gray-600">sparpreis.guru</span> - Alle Rechte vorbehalten
            </div>
            <div className="mt-2 sm:mt-0">
              Version {appVersion}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}