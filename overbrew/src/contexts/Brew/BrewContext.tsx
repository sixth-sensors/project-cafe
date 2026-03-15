import { useEffect, useState, type ReactNode } from 'react'
import { useTelemetryStream } from '../../hooks/useTelemetryStream'
import { BASE_URL } from '../../lib/api'
import { BrewContext } from './context'

export const BrewProvider = ({ children }: { children: ReactNode }) => {
  const { connected, latest } = useTelemetryStream()
  const [brewActive, setBrewActive] = useState(false)
  const [brewStartTime, setBrewStartTime] = useState<Date | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${BASE_URL}/homebrew/brew`, {
          headers: { Accept: 'application/json' },
        })
        if (response.ok) {
          const data = await response.json()
          if (isMounted) {
            if (data.type === 'brew' && data.payload?.started_at) {
              setBrewActive(true)
              setBrewStartTime(new Date(data.payload.started_at))
            } else {
              setBrewActive(false)
              setBrewStartTime(null)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch brew status:', error)
      }
    }
    fetchStatus()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    switch (latest?.type) {
      case 'connected':
        if (latest.brew_status !== undefined) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBrewActive(latest.brew_status)
        }
        break
      case 'brew_started':
        setBrewActive(true)

        setBrewStartTime(new Date())
        break
      case 'brew_finished':
      case 'brew_aborted':
        setBrewActive(false)

        setBrewStartTime(null)
        break
    }
  }, [latest])

  return (
    <BrewContext.Provider
      value={{ brewActive, brewStartTime, connected, latest }}
    >
      {children}
    </BrewContext.Provider>
  )
}
