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
  const { latest, brewActive, brewStartTime } = useBrew()
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([])
  const [progress, setProgress] = useState(0.0)
  const [flowRate, setFlowRate] = useState(0.0)
  const [waterLevel, setWaterLevel] = useState(100)
  const [brewQuantityMl, setBrewQuantityMl] = useState(DEFAULT_BREW_QUANTITY_ML)
  const [pumpedVolumeMl, setPumpedVolumeMl] = useState(0)
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
    switch (latest?.type) {
      case 'brew_started':
        if (finishedProgressTimerRef.current) {
          clearTimeout(finishedProgressTimerRef.current)
          finishedProgressTimerRef.current = null
        }
        setShowCompletedProgress(false)
        setProgress(0)
        setFlowRate(0.0)
        setWaterLevel(100)
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
        setProgress(1)
        finishedProgressTimerRef.current = setTimeout(() => {
          setShowCompletedProgress(false)
          setProgress(0)
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
        setProgress(0)
        setFlowRate(0.0)
        setLastTelemetryTimestamp(null)
        setTemperatureData([])
        break
      case 'telemetry':
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
    }
  }, [brewQuantityMl, lastTelemetryTimestamp, latest, startTemperature])

  useEffect(() => {
    const waterRemainingMl = Math.max(0, TANK_CAPACITY_ML - pumpedVolumeMl)
    const estimatedWaterLevel = (waterRemainingMl / TANK_CAPACITY_ML) * 100
    setWaterLevel(Math.max(0, Math.min(100, estimatedWaterLevel)))

    if (
      !brewActive ||
      startTemperature === null ||
      targetTemperature === null ||
      latestTemperature === null
    ) {
      if (!brewActive && !showCompletedProgress) {
        setProgress(0)
      }
      return
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

    setProgress(
      Math.max(0, Math.min(1, 0.5 * tempFraction + 0.5 * pumpFraction))
    )
  }, [
    brewActive,
    brewQuantityMl,
    latestTemperature,
    pumpedVolumeMl,
    showCompletedProgress,
    startTemperature,
    targetTemperature,
  ])

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

  return (
    <div className="info-wrapper">
      <div className="brew-status-text">
        {brewActive
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
