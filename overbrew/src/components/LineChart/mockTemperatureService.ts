import { ROOM_TEMPERATURE, TARGET_THRESHOLD } from '../../constants/temperature'
import type { TemperatureReading } from '../../pages/Home/Grids/Info.types'

const HEATING_RATE_BASE = 4.0
const HEATING_RATE_VARIANCE = 3.0
const FLUCTUATION_RANGE = 1.5

export class MockTemperatureService {
  private currentTemp: number
  private targetTemp: number

  constructor(targetTemperature: number) {
    this.currentTemp = ROOM_TEMPERATURE + (Math.random() - 0.5) * 2 // Start near room temp
    this.targetTemp = targetTemperature
  }

  setTargetTemperature(newTarget: number): void {
    this.targetTemp = newTarget
  }

  getNextReading(): TemperatureReading {
    const now = new Date()
    const timeString = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const distanceFromTarget = this.targetTemp - this.currentTemp

    if (Math.abs(distanceFromTarget) > TARGET_THRESHOLD) {
      const heatingRate =
        HEATING_RATE_BASE + (Math.random() - 0.5) * HEATING_RATE_VARIANCE
      this.currentTemp += heatingRate

      if (this.currentTemp > this.targetTemp) {
        this.currentTemp =
          this.targetTemp + (Math.random() - 0.5) * FLUCTUATION_RANGE
      }
    } else {
      const fluctuation = (Math.random() - 0.5) * FLUCTUATION_RANGE * 2
      this.currentTemp = this.targetTemp + fluctuation
    }

    return {
      time: timeString,
      temperature: parseFloat(this.currentTemp.toFixed(1)),
      timestamp: Date.now(),
    }
  }

  getCurrentTemperature(): number {
    return parseFloat(this.currentTemp.toFixed(1))
  }

  reset(): void {
    this.currentTemp = ROOM_TEMPERATURE + (Math.random() - 0.5) * 2
  }
}
