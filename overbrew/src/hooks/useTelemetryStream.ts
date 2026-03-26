import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { BASE_URL } from '../lib/api'
import type { TelemetryType } from '../constants/telemetry'

export interface TelemetryEvent {
  type: TelemetryType
  request_id: string
  time: string
  temp: number
  target_temp: number
  timestamp: number
  flow_rate?: number
  brew_status?: boolean
}

export const useTelemetryStream = () => {
  const { user } = useAuth()

  const eventSourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)
  const [latest, setLatest] = useState<TelemetryEvent | null>(null)

  useEffect(() => {
    let cancelled = false

    const startStream = async () => {
      if (!user) return

      const token = await user.getIdToken()
      const url = `${BASE_URL}/telemetry/stream?token=${token}`

      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      eventSource.onmessage = (e) => {
        const event = JSON.parse(e.data)
        setLatest(event)
        console.log('Received telemetry:', event)
      }

      eventSource.onerror = () => {
        if (!cancelled) setConnected(false)
      }
    }

    startStream()

    return () => {
      cancelled = true
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [user])

  return { connected, latest }
}
