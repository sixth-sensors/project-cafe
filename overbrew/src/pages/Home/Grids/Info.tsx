import { useEffect, useRef, useState } from 'react'
import type { TemperatureReading } from './Info.types'
import { MockTemperatureService } from '../../../components/LineChart/mockTemperatureService'
import {
  TARGET_TEMPERATURE,
  NUM_TEMPERATURE_POINTS,
} from '../../../constants/temperature'
import LineChart from '../../../components/LineChart/LineChart'
import './Grids.css'

const Info = () => {
  const [temperatureData, setTemperatureData] = useState<TemperatureReading[]>(
    []
  )

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
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid info-content">
      <div className="card">Card 1</div>
      <div className="grid info-bottom">
        <div className="card">Card 2</div>
        <div className="card">Card 3</div>
        <div className="card">
          <LineChart data={temperatureData} target={TARGET_TEMPERATURE} />
        </div>
      </div>
    </div>
  )
}

export default Info
