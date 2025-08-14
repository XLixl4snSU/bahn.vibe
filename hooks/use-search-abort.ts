// Erstelle eine einfache Abbruch-Hook für die Search-Funktionalität
'use client'

import { useEffect, useRef } from 'react'

export function useSearchAbort(sessionId: string | null, onAbort?: () => void) {
  const abortedRef = useRef(false)

  const abortSearch = async () => {
    if (!sessionId || abortedRef.current) return

    try {
      abortedRef.current = true
      
      // Sende Abbruch-Signal an Server
      await fetch(`/api/search-progress?sessionId=${sessionId}`, {
        method: 'DELETE',
      })

      if (onAbort) {
        onAbort()
      }
    } catch (error) {
      console.error('Fehler beim Abbrechen der Suche:', error)
    }
  }

  // Automatisches Abbrechen beim Verlassen der Seite
  useEffect(() => {
    if (!sessionId) return

    const handleBeforeUnload = () => {
      if (!abortedRef.current) {
        // Verwende sendBeacon für zuverlässige Übertragung beim Seitenverlassen
        navigator.sendBeacon(`/api/search-progress?sessionId=${sessionId}`, 
          JSON.stringify({ method: 'DELETE' }))
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden && !abortedRef.current) {
        abortSearch()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessionId])

  return { abortSearch, isAborted: abortedRef.current }
}