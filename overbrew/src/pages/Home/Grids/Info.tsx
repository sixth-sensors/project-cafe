import { useEffect, useState } from 'react'
import { TARGET_TEMPERATURE } from '../../../constants/temperature'
import LineChart from '../../../components/LineChart/LineChart'
import ProgressBar from '../../../components/ProgressBar/ProgressBar'
import FlowRateDropper from '../../../components/FlowRateDropper/FlowRateDropper'
import WaterLevel from '../../../components/WaterLevel/WaterLevel'
import './Grids.css'
import { useTelemetryStream } from '../../../hooks/useTelemetryStream'
import { useAuth } from '../../../hooks/useAuth'
import { apiFetch, SENDER_ID } from '../../../lib/api'

import { FaTimes } from 'react-icons/fa'

interface TemperatureData {
  temperature: number
  timestamp: number
  time: string
  target_temp?: number
}

const Info = () => {
  const { user } = useAuth()
  const { latest } = useTelemetryStream()
  const [brewActive, setBrewActive] = useState(false)
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([])
  const [progress, setProgress] = useState(0.0)
  const [flowRate, setFlowRate] = useState(0.0)

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
      case 'connected':
        latest.brew_status && setBrewActive(latest.brew_status)
        break
      case 'brew_started':
        setBrewActive(true)
        break
      case 'brew_finished':
      case 'brew_aborted':
        setBrewActive(false)
        setProgress(0)
        setFlowRate(0.0)
        setTemperatureData([])
        break
      case 'telemetry':
         
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
  }, [latest])

  useEffect(() => {
    const interval = setInterval(() => {
      if (brewActive) {
        setProgress((prev) => (prev < 1.0 ? Math.min(1, prev + 0.02) : prev))
        setFlowRate((prev) => (prev < 4.0 ? Math.min(4, prev + 0.1) : prev))
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [brewActive])

  return (
    <div className="grid info-content">
      <div className="card progress-card">
        <ProgressBar progress={progress} />
        <div className="abort-container">
          <button className="abort-button" onClick={handleAbort} type="button">
            <FaTimes size={32} />
          </button>
          <span>Abort</span>
        </div>
      </div>
      <div className="grid info-bottom">
        <div className="card water-level">
          <WaterLevel percentage={progress * 100} />
        </div>
        <div className="card dropper">
          <FlowRateDropper flowRate={flowRate} />
        </div>
        <div className="card">
          <LineChart
            data={temperatureData}
            target={temperatureData[0]?.target_temp ?? TARGET_TEMPERATURE}
          />
        </div>
      </div>
    </div>
  )
}

export default Info
