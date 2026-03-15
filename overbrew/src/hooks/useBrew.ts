import { useContext } from 'react'
import { BrewContext } from '../contexts/Brew/BrewContext'

export const useBrew = () => {
  const context = useContext(BrewContext)
  if (context === undefined) {
    throw new Error('useBrew must be used within a BrewProvider')
  }
  return context
}
