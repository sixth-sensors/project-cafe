import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { BASE_URL } from '../lib/api'
import type { TelemetryType } from '../constants/telemetry'

export type TelemetryStreamStatus =
  | 'loading'
  | 'connected'
  | 'reconnecting'
  | 'error'

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
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const [streamStatus, setStreamStatus] =
    useState<TelemetryStreamStatus>('loading')
  const [latest, setLatest] = useState<TelemetryEvent | null>(null)

  useEffect(() => {
    let cancelled = false
    const resetConnection = () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }

    const startStream = async () => {
      if (!user) return

      if (!cancelled) {
        const nextStatus =
          reconnectAttemptRef.current > 0 ? 'reconnecting' : 'loading'
        setStreamStatus(nextStatus)
      }

      try {
        const token = await user.getIdToken(true)
        const url = `${BASE_URL}/telemetry/stream?token=${token}`

        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          reconnectAttemptRef.current = 0
          if (!cancelled) {
            setStreamStatus('connected')
          }
        }

        eventSource.onmessage = (e) => {
          const event = JSON.parse(e.data)
          setLatest(event)
          console.log('Received telemetry:', event)
        }

        eventSource.onerror = () => {
          if (cancelled) return

          setStreamStatus('reconnecting')
          resetConnection()

          reconnectAttemptRef.current += 1
          const delayMs = Math.min(5000, 500 * reconnectAttemptRef.current)

          if (reconnectTimeoutRef.current !== null) {
            window.clearTimeout(reconnectTimeoutRef.current)
          }

          reconnectTimeoutRef.current = window.setTimeout(() => {
            void startStream()
          }, delayMs)
        }
      } catch {
        if (!cancelled) {
          setStreamStatus('error')
        }
      }
    }

    if (!user) {
      return
    }

    void startStream()

    return () => {
      cancelled = true
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      resetConnection()
    }
  }, [user])

  const connected = !!user && streamStatus === 'connected'

  return { connected, streamStatus, latest }
}
