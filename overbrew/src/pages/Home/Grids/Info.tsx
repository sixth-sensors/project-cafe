import { useEffect, useState } from 'react'
import { TARGET_TEMPERATURE } from '../../../constants/temperature'
import LineChart from '../../../components/LineChart/LineChart'
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

  return (
    <div className="grid info-content">
      <div className="card">Card 1</div>
      <div className="grid info-bottom">
        <div className="card">Card 2</div>
        <div className="card">Card 3</div>
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
