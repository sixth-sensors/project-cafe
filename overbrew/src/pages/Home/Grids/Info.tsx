import { useEffect, useState } from 'react'
import { TARGET_TEMPERATURE } from '../../../constants/temperature'
import LineChart from '../../../components/LineChart/LineChart'
import ProgressBar from '../../../components/ProgressBar/ProgressBar'
import FlowRateDropper from '../../../components/FlowRateDropper/FlowRateDropper'
import WaterLevel from '../../../components/WaterLevel/WaterLevel'
import './Grids.css'
import { useTelemetryStream } from '../../../hooks/useTelemetryStream'

interface TemperatureData {
  time: string
  temperature: number
  timestamp: number
  target_temp?: number
}

const Info = () => {
  const { latest } = useTelemetryStream()
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([])
  const [progress, setProgress] = useState(0.0)
  const [flowRate, setFlowRate] = useState(0.1)

  useEffect(() => {
    if (!latest || latest.type !== 'telemetry') return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemperatureData((prev) => [
      ...prev,
      {
        time: latest.time,
        temperature: latest.temp,
        timestamp: latest.timestamp,
      },
    ])
  }, [latest])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 1.0 ? Math.min(1, prev + 0.02) : prev))
      setFlowRate((prev) => (prev < 4.0 ? Math.min(4, prev + 0.1) : prev))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid info-content">
      <div className="card">
        <ProgressBar progress={progress} />
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
