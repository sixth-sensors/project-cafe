import { useEffect, useRef, useState } from 'react'
import type { TemperatureReading } from './Info.types'
import { MockTemperatureService } from '../../../components/LineChart/mockTemperatureService'
import {
  TARGET_TEMPERATURE,
  NUM_TEMPERATURE_POINTS,
} from '../../../constants/temperature'
import LineChart from '../../../components/LineChart/LineChart'
import ProgressBar from '../../../components/ProgressBar/ProgressBar'
import FlowRateDropper from '../../../components/FlowRateDropper/FlowRateDropper'
import WaterLevel from '../../../components/WaterLevel/WaterLevel'
import './Grids.css'

const Info = () => {
  const [temperatureData, setTemperatureData] = useState<TemperatureReading[]>(
    []
  )
  const [progress, setProgress] = useState(0.0)
  const [flowRate, setFlowRate] = useState(0.1)

  // TODO: Replace with actual backend service when available
  const mockServiceRef = useRef(new MockTemperatureService(TARGET_TEMPERATURE))

  useEffect(() => {
    const interval = setInterval(() => {
      // TODO: Replace with actual backend endpoint when available
      const newReading = mockServiceRef.current.getNextReading()
      setTemperatureData((prev) => {
        const updated = [...prev, newReading]
        return updated.slice(-NUM_TEMPERATURE_POINTS)
      })
      if (progress < 1.0) {
        setProgress((prev) => Math.min(1, prev + 0.02))
      }
      if (flowRate < 4.0) {
        setFlowRate((prev) => Math.min(4, prev + 0.1))
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [progress])

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
          <LineChart data={temperatureData} target={TARGET_TEMPERATURE} />
        </div>
      </div>
    </div>
  )
}

export default Info
