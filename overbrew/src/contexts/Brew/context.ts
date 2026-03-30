import { createContext } from 'react'
import type { BrewContextType } from './BrewContext.types'

export const BrewContext = createContext<BrewContextType>({
  brewActive: false,
  brewStartTime: null,
  connected: false,
  streamStatus: 'loading',
  latest: null,
})
