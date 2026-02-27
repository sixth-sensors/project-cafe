import './Grids.css'
import { useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { apiFetch } from '../../../lib/api'
import BrewButton from '../../../components/BrewButton/BrewButton'
import Slider from '../../../components/Slider/Slider'

// TODO: remove

type Brew = {
  id: string
  title: string
  details: string
  isFavorite: boolean
  timestamp: string
}

const mockBrewData = [
  {
    id: 'mock-brew-1',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: true,
    timestamp: '2026-02-26T18:01:45Z',
  },
  {
    id: 'mock-brew-2',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: true,
    timestamp: '2026-02-26T18:01:44Z',
  },
  {
    id: 'mock-brew-3',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: false,
    timestamp: '2026-02-26T18:01:43Z',
  },
  {
    id: 'mock-brew-4',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: false,
    timestamp: '2026-02-26T18:01:42Z',
  },
  {
    id: 'mock-brew-5',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: false,
    timestamp: '2026-02-26T18:01:41Z',
  },
  {
    id: 'mock-brew-6',
    title: 'Mock Brew',
    details: 'This is a mock brew for testing purposes.',
    isFavorite: false,
    timestamp: '2026-02-26T18:01:40Z',
  },
] satisfies Brew[]

const Brew = () => {
  const { user } = useAuth()
  const [temperature, setTemperature] = useState(60)
  const [flowRate, setFlowRate] = useState(0.1)
  const [brews, setBrews] = useState<Brew[]>(mockBrewData)
  const sortedBrews = [...brews].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const favouriteBrews = sortedBrews.filter((brew) => brew.isFavorite)
  const recentBrews = sortedBrews.filter((brew) => !brew.isFavorite)

  const handleToggleFavorite = (id: string) => {
    setBrews((currentBrews) =>
      currentBrews.map((brew) =>
        brew.id === id ? { ...brew, isFavorite: !brew.isFavorite } : brew
      )
    )
  }

  const handleStartBrew = async () => {
    if (!user) return

    try {
      // TODO: Trigger a mock brew for now
      await apiFetch('/mock-brew', user, { method: 'POST' })
      window.location.hash = '#info'
    } catch (error) {
      console.error('Error starting brew:', error)
      alert('Failed to start brew')
    }
  }

  return (
    <div className="grid brew-content">
      <div className="card brew-list-card">
        <div className="brew-list">
          <h2>Your Brews</h2>

          {favouriteBrews.length > 0 && (
            <>
              <h3 className="brew-list-section-title">Favourites</h3>
              {favouriteBrews.map(
                ({ id, title, details, isFavorite, timestamp }) => (
                  <BrewButton
                    key={id}
                    title={title}
                    details={details}
                    isFavorite={isFavorite}
                    timestamp={timestamp}
                    onToggleFavorite={() => handleToggleFavorite(id)}
                  />
                )
              )}
            </>
          )}

          <h3 className="brew-list-section-title">Recent</h3>
          {recentBrews.length === 0 ? (
            <p className="brew-list-empty">No recent brews.</p>
          ) : (
            recentBrews.map(({ id, title, details, isFavorite, timestamp }) => (
              <BrewButton
                key={id}
                title={title}
                details={details}
                isFavorite={isFavorite}
                timestamp={timestamp}
                onToggleFavorite={() => handleToggleFavorite(id)}
              />
            ))
          )}
        </div>
      </div>
      <div className="grid brew-right">
        <div className="card brew-settings">
          <div className="brew-settings-screen">
            <span className="settings-header" />
            <div className="settings-content">
              <h2>Brew Settings</h2>
              <div className="sliders-container">
                <Slider
                  min={60}
                  max={100}
                  step={1}
                  gradientMin="#BFFAFF"
                  gradientMax="#F23232"
                  defaultValue={temperature}
                  label="Temperature (°C)"
                  onChange={setTemperature}
                />
                <Slider
                  min={0.1}
                  max={4.0}
                  step={0.1}
                  gradientMin="var(--lighter-brown)"
                  gradientMax="var(--dark-brown)"
                  defaultValue={flowRate}
                  label="Flow Rate (g/s)"
                  onChange={setFlowRate}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <h2>Confirm Brew</h2>
          <div className="brew-summary">
            <div>Temperature</div>
            <div>Flow Rate</div>
            <button onClick={handleStartBrew} type="button">
              Start Mock Brew
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Brew
