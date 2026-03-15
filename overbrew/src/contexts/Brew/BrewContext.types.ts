import type { TelemetryEvent } from '../../hooks/useTelemetryStream'

export interface BrewContextType {
  brewActive: boolean
  brewStartTime: Date | null
  connected: boolean
  latest: TelemetryEvent | null
}
