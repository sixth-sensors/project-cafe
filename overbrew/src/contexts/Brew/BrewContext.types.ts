import type { TelemetryEvent } from '../../hooks/useTelemetryStream'
import type { TelemetryStreamStatus } from '../../hooks/useTelemetryStream'

export interface BrewContextType {
  brewActive: boolean
  brewStartTime: Date | null
  connected: boolean
  streamStatus: TelemetryStreamStatus
  latest: TelemetryEvent | null
}
