import { useEffect, useRef, useState } from 'react'
import LineChart from '../../../components/LineChart/LineChart'
import ProgressBar from '../../../components/ProgressBar/ProgressBar'
import FlowRateDropper from '../../../components/FlowRateDropper/FlowRateDropper'
import WaterLevel from '../../../components/WaterLevel/WaterLevel'
import './Grids.css'
import { useAuth } from '../../../hooks/useAuth'
import { useBrew } from '../../../hooks/useBrew'
import { apiFetch, BASE_URL, SENDER_ID } from '../../../lib/api'

import { FaTimes } from 'react-icons/fa'

interface TemperatureData {
  temperature: number
  timestamp: number
  time: string
  target_temp?: number
}

const TANK_CAPACITY_ML = 1700
const DEFAULT_BREW_QUANTITY_ML = 350
const FINISHED_PROGRESS_HOLD_MS = 1200

const Info = () => {
  const { user } = useAuth()
  const { latest, brewActive, brewStartTime, streamStatus } = useBrew()
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([])
  const [flowRate, setFlowRate] = useState(0.0)
  const [brewQuantityMl, setBrewQuantityMl] = useState(DEFAULT_BREW_QUANTITY_ML)
  const [pumpedVolumeMl, setPumpedVolumeMl] = useState(0)
  const [waterRemainingMl, setWaterRemainingMl] = useState(TANK_CAPACITY_ML)
  const [startTemperature, setStartTemperature] = useState<number | null>(null)
  const [targetTemperature, setTargetTemperature] = useState<number | null>(
    null
  )
  const [latestTemperature, setLatestTemperature] = useState<number | null>(
    null
  )
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<
    number | null
  >(null)
  const [showCompletedProgress, setShowCompletedProgress] = useState(false)
  const finishedProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const waterLevel = Math.max(
    0,
    Math.min(100, (waterRemainingMl / TANK_CAPACITY_ML) * 100)
  )

  const handleAbort = async () => {
    if (!user || !confirm('Are you sure you want to abort the current brew?'))
      return

    try {
      await apiFetch('/abort', user, {
        method: 'POST',
        body: JSON.stringify({ sender_id: SENDER_ID, user_id: user.uid }),
      })
    } catch (error) {
      console.error('Failed to abort:', error)
    }
  }

  useEffect(() => {
    const updateTimer = setTimeout(() => {
      switch (latest?.type) {
        case 'brew_started':
          if (finishedProgressTimerRef.current) {
            clearTimeout(finishedProgressTimerRef.current)
            finishedProgressTimerRef.current = null
          }
          setShowCompletedProgress(false)
          setFlowRate(0.0)
          setPumpedVolumeMl(0)
          setStartTemperature(null)
          setTargetTemperature(null)
          setLatestTemperature(null)
          setLastTelemetryTimestamp(null)
          setTemperatureData([])
          break
        case 'brew_finished':
          if (finishedProgressTimerRef.current) {
            clearTimeout(finishedProgressTimerRef.current)
          }
          setShowCompletedProgress(true)
          finishedProgressTimerRef.current = setTimeout(() => {
            setShowCompletedProgress(false)
          }, FINISHED_PROGRESS_HOLD_MS)
          setFlowRate(0.0)
          setLastTelemetryTimestamp(null)
          setTemperatureData([])
          break
        case 'brew_aborted':
          if (finishedProgressTimerRef.current) {
            clearTimeout(finishedProgressTimerRef.current)
            finishedProgressTimerRef.current = null
          }
          setShowCompletedProgress(false)
          setFlowRate(0.0)
          setLastTelemetryTimestamp(null)
          setTemperatureData([])
          break
        case 'telemetry': {
          setFlowRate(latest.flow_rate ?? 0.0)
          setLatestTemperature(latest.temp)
          if (startTemperature === null) {
            setStartTemperature(latest.temp)
          }
          if (
            typeof latest.target_temp === 'number' &&
            targetTemperature === null
          ) {
            setTargetTemperature(latest.target_temp)
          }

          const currentTimestamp = latest.timestamp
          if (
            typeof latest.flow_rate === 'number' &&
            latest.flow_rate > 0 &&
            typeof currentTimestamp === 'number' &&
            lastTelemetryTimestamp !== null &&
            currentTimestamp > lastTelemetryTimestamp
          ) {
            const deltaSeconds =
              (currentTimestamp - lastTelemetryTimestamp) / 1000
            const pumpedDelta = latest.flow_rate * deltaSeconds
            setPumpedVolumeMl((prev) => {
              const maxPumpable = Math.max(0, brewQuantityMl)
              return Math.min(maxPumpable, prev + pumpedDelta)
            })
            setWaterRemainingMl((prev) => Math.max(0, prev - pumpedDelta))
          }

          if (typeof currentTimestamp === 'number') {
            setLastTelemetryTimestamp(currentTimestamp)
          }

          setTemperatureData((prev) => [
            ...prev,
            {
              temperature: latest.temp,
              time: new Date(latest.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              timestamp: latest.timestamp,
              target_temp: latest.target_temp,
            },
          ])
          break
        }
      }
    }, 0)

    return () => clearTimeout(updateTimer)
  }, [
    brewQuantityMl,
    lastTelemetryTimestamp,
    latest,
    startTemperature,
    targetTemperature,
  ])

  const progress = (() => {
    if (showCompletedProgress) return 1

    if (
      !brewActive ||
      startTemperature === null ||
      targetTemperature === null ||
      latestTemperature === null
    ) {
      return 0
    }

    const tempRange = targetTemperature - startTemperature
    const tempFraction =
      tempRange <= 0
        ? 1
        : Math.max(
            0,
            Math.min(1, (latestTemperature - startTemperature) / tempRange)
          )

    const pumpFraction =
      brewQuantityMl <= 0
        ? 0
        : Math.max(0, Math.min(1, pumpedVolumeMl / brewQuantityMl))

    return Math.max(0, Math.min(1, 0.5 * tempFraction + 0.5 * pumpFraction))
  })()

  useEffect(() => {
    return () => {
      if (finishedProgressTimerRef.current) {
        clearTimeout(finishedProgressTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchActiveBrew = async () => {
      if (!brewActive) return
      try {
        const response = await fetch(`${BASE_URL}/homebrew/brew`, {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return

        const data = await response.json()
        if (!isMounted || data?.type !== 'brew' || !data?.payload) return

        if (
          typeof data.payload.quantity === 'number' &&
          data.payload.quantity > 0
        ) {
          setBrewQuantityMl(data.payload.quantity)
        }

        if (
          typeof data.payload.target_temperature === 'number' &&
          targetTemperature === null
        ) {
          setTargetTemperature(data.payload.target_temperature)
        }
      } catch (error) {
        console.error('Failed to fetch active brew details:', error)
      }
    }

    fetchActiveBrew()
    return () => {
      isMounted = false
    }
  }, [brewActive, targetTemperature])

  useEffect(() => {
    const wKeyPressedRef = { current: false }

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA'
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'w') {
        wKeyPressedRef.current = true
        return
      }

      if (!wKeyPressedRef.current) return
      if (!/^\d$/.test(event.key)) return

      const digit = Number(event.key)
      const percentage = digit === 0 ? 100 : digit * 10
      const remainingMl = (percentage / 100) * TANK_CAPACITY_ML
      setWaterRemainingMl(remainingMl)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'w') {
        wKeyPressedRef.current = false
      }
    }

    const onWindowBlur = () => {
      wKeyPressedRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  return (
    <div className="info-wrapper">
      <div className="brew-status-text">
        {streamStatus !== 'connected'
          ? 'Connecting to telemetry stream...'
          : brewActive
            ? `Brew active - Started at ${brewStartTime ? brewStartTime.toLocaleTimeString() : '...'}`
            : 'No brew currently active'}
      </div>
      <div className="grid info-content">
        <div className="card progress-card">
          <ProgressBar progress={progress} />
          <div className="abort-container">
            <button
              className="abort-button"
              disabled={!brewActive}
              onClick={handleAbort}
              type="button"
            >
              <FaTimes size={32} />
            </button>
            <span>Abort</span>
          </div>
        </div>
        <div className="grid info-bottom">
          <div className="card water-level">
            <WaterLevel percentage={waterLevel} />
          </div>
          <div className="card dropper">
            <FlowRateDropper flowRate={flowRate} />
          </div>
          <div className="card">
            <LineChart
              data={temperatureData}
              target={temperatureData[0]?.target_temp ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Info
