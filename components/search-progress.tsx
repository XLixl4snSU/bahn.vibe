"use client"

import { useEffect, useState } from "react"
import { Progress } from "./ui/progress"

interface SearchProgressProps {
  sessionId: string | null
  searchParams: {
    start?: string
    ziel?: string
    dayLimit?: string
  }
}

interface ProgressData {
  currentDay: number
  totalDays: number
  isComplete: boolean
  estimatedTimeRemaining: number
  currentDate: string
}

export function SearchProgress({ sessionId, searchParams }: SearchProgressProps) {
  const [progress, setProgress] = useState<ProgressData>({
    currentDay: 0,
    totalDays: Number.parseInt(searchParams.dayLimit || "3"),
    isComplete: false,
    estimatedTimeRemaining: 0,
    currentDate: ""
  })

  useEffect(() => {
    if (!sessionId) return

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/search-progress?sessionId=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setProgress(data)
          
          // Stop polling wenn complete
          if (data.isComplete) {
            return
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }

    // Initial poll
    pollProgress()

    // Poll every 500ms
    const interval = setInterval(pollProgress, 500)

    return () => clearInterval(interval)
  }, [sessionId])

  const progressPercentage = progress.totalDays > 0 
    ? Math.round((progress.currentDay / progress.totalDays) * 100) 
    : 0

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-4 w-full max-w-full">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🚂</div>
          <div>
            <h3 className="font-semibold text-blue-800">Suche Bestpreise</h3>
            <p className="text-sm text-blue-600">
              {searchParams.start} → {searchParams.ziel}
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tag {progress.currentDay} von {progress.totalDays}</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Current Status */}
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-600">
              {progress.currentDate && (
                <span>Aktuell: {new Date(progress.currentDate).toLocaleDateString('de-DE')}</span>
              )}
            </div>
            <div className="text-blue-600 font-medium">
              {progress.estimatedTimeRemaining > 0 && !progress.isComplete && (
                <span>noch ca. {formatTime(progress.estimatedTimeRemaining)}</span>
              )}
              {progress.isComplete && (
                <span className="text-green-600">✓ Abgeschlossen</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}