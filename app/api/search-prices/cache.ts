// Cache-Interface
interface CacheEntry {
  data: TrainResults | null
  timestamp: number
  ttl: number // Time to live in milliseconds
}

// In-Memory Cache
const cache = new Map<string, CacheEntry>()

// Cache-Konfiguration
const CACHE_TTL = 60 * 60 * 1000 // 60 Minuten in Millisekunden
const MAX_CACHE_ENTRIES = 100000

interface TrainResult {
  preis: number
  info: string
  abfahrtsZeitpunkt: string
  ankunftsZeitpunkt: string
  allIntervals?: Array<{
    preis: number
    abschnitte?: Array<{
      abfahrtsZeitpunkt: string
      ankunftsZeitpunkt: string
      abfahrtsOrt: string
      ankunftsOrt: string
    }>
    abfahrtsZeitpunkt: string
    ankunftsZeitpunkt: string
    abfahrtsOrt: string
    ankunftsOrt: string
    info: string
    umstiegsAnzahl: number
    isCheapestPerInterval?: boolean
  }>
}

interface TrainResults {
  [date: string]: TrainResult
}

// Cache-Hilfsfunktionen
export function generateCacheKey(params: {
  startStationId: string
  zielStationId: string
  date: string
  alter: string
  ermaessigungArt: string
  ermaessigungKlasse: string
  klasse: string
  maximaleUmstiege: number
  schnelleVerbindungen: boolean
  nurDeutschlandTicketVerbindungen: boolean
  abfahrtAb?: string
  ankunftBis?: string
}): string {
  return JSON.stringify(params)
}

export function getCachedResult(cacheKey: string): TrainResults | null {
  console.log(`🔍 Looking for cache key: ${cacheKey.substring(0, 100)}...`)
  console.log(`📊 Cache currently has ${cache.size} entries`)
  
  const entry = cache.get(cacheKey)
  if (!entry) {
    console.log(`❌ No cache entry found`)
    return null
  }
  
  const now = Date.now()
  const age = now - entry.timestamp
  console.log(`⏱️ Cache entry age: ${Math.round(age / 1000)}s, TTL: ${Math.round(entry.ttl / 1000)}s`)
  
  if (age > entry.ttl) {
    // Cache ist abgelaufen
    console.log(`⏰ Cache entry expired`)
    cache.delete(cacheKey)
    return null
  }
  
  console.log(`📦 Cache hit for key: ${cacheKey.substring(0, 100)}...`)
  return entry.data
}

export function setCachedResult(cacheKey: string, data: TrainResults | null): void {
  // LRU-Prinzip: Wenn Limit erreicht, entferne ältesten Eintrag
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (typeof oldestKey === 'string') {
      cache.delete(oldestKey)
      console.log(`🗑️ Removed oldest cache entry to keep cache size <= ${MAX_CACHE_ENTRIES}`)
    }
  }
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  })
  console.log(`💾 Cached result for key: ${cacheKey.substring(0, 100)}...`)
  // Speicherverbrauch schätzen (Summe der JSON-Strings aller Cache-Values)
  let totalBytes = 0
  for (const entry of cache.values()) {
    try {
      totalBytes += Buffer.byteLength(JSON.stringify(entry), 'utf8')
    } catch {}
  }
  let sizeStr = totalBytes < 1024 * 1024
    ? (totalBytes / 1024).toFixed(1) + ' kB'
    : (totalBytes / (1024 * 1024)).toFixed(2) + ' MB'
  const humanReadable = cache.size.toLocaleString('de-DE')
  console.log(`📊 Cache now has ${cache.size} entries (${humanReadable}), approx. ${sizeStr}`)
}

// Cache-Bereinigung (entfernt abgelaufene Einträge)
function cleanupCache(): void {
  const now = Date.now()
  let removed = 0
  
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key)
      removed++
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired cache entries. Cache size: ${cache.size}`)
  }
}

// Cache-Bereinigung alle 5 Minuten
setInterval(cleanupCache, 5 * 60 * 1000)

export function getCacheSize(): number {
  return cache.size
}