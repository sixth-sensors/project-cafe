import './Grids.css'
import { useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { apiFetch, SENDER_ID } from '../../../lib/api'
import BrewButton from '../../../components/BrewButton/BrewButton'
import Slider from '../../../components/Slider/Slider'
import { FaPlay } from 'react-icons/fa'

// TODO: remove

export type BrewSettings = {
  temperature: number
  flowRate: number
}

type Brew = {
  id: string
  title: string
  settings: BrewSettings
  isFavorite: boolean
  timestamp: string
}

const mockBrewData = [
  {
    id: 'mock-brew-1',
    title: 'Mock Brew',
    settings: {
      temperature: 96,
      flowRate: 2.5,
    },
    isFavorite: true,
    timestamp: '2026-02-26T18:01:45Z',
  },
  {
    id: 'mock-brew-2',
    title: 'Mock Brew',
    settings: {
      temperature: 95,
      flowRate: 2.4,
    },
    isFavorite: true,
    timestamp: '2026-02-26T18:01:44Z',
  },
  {
    id: 'mock-brew-3',
    title: 'Mock Brew',
    settings: {
      temperature: 94,
      flowRate: 2.3,
    },
    isFavorite: false,
    timestamp: '2026-02-26T18:01:43Z',
  },
  {
    id: 'mock-brew-4',
    title: 'Mock Brew',
    settings: {
      temperature: 93,
      flowRate: 2.2,
    },
    isFavorite: false,
    timestamp: '2026-02-26T18:01:42Z',
  },
  {
    id: 'mock-brew-5',
    title: 'Mock Brew',
    settings: {
      temperature: 92,
      flowRate: 2.1,
    },
    isFavorite: false,
    timestamp: '2026-02-26T18:01:41Z',
  },
  {
    id: 'mock-brew-6',
    title: 'Mock Brew',
    settings: {
      temperature: 91,
      flowRate: 2.0,
    },
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

  const handleBrewSelect = (settings: BrewSettings) => {
    setTemperature(settings.temperature)
    setFlowRate(settings.flowRate)
  }

  const handleStartBrew = async () => {
    if (!user) return

    try {
      await apiFetch('/brew', user, {
        method: 'POST',
        body: JSON.stringify({
          sender_id: SENDER_ID,
          type: 'brew',
          user_id: user.uid,
          create_profile: false,
          temperature,
          flow_rate: flowRate,
          intent: `Brew at ${temperature}°C, ${flowRate}g/s`,
        }),
      })
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

          {favouriteBrews.length > 0 ? (
            <>
              <h3 className="brew-list-section-title">Favourites</h3>
              {favouriteBrews.map(
                ({ id, title, settings, isFavorite, timestamp }) => (
                  <BrewButton
                    isFavorite={isFavorite}
                    key={id}
                    onClick={handleBrewSelect}
                    onToggleFavorite={() => handleToggleFavorite(id)}
                    settings={settings}
                    timestamp={timestamp}
                    title={title}
                  />
                )
              )}
            </>
          ) : null}

          <h3 className="brew-list-section-title">Recent</h3>
          {recentBrews.length === 0 ? (
            <p className="brew-list-empty">No recent brews.</p>
          ) : (
            recentBrews.map(
              ({ id, title, settings, isFavorite, timestamp }) => (
                <BrewButton
                  isFavorite={isFavorite}
                  key={id}
                  onClick={handleBrewSelect}
                  onToggleFavorite={() => handleToggleFavorite(id)}
                  settings={settings}
                  timestamp={timestamp}
                  title={title}
                />
              )
            )
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
                  gradientMax="#F23232"
                  gradientMin="#BFFAFF"
                  label="Temperature (°C)"
                  max={100}
                  min={60}
                  onChange={setTemperature}
                  step={1}
                  value={temperature}
                />
                <Slider
                  gradientMax="var(--dark-brown)"
                  gradientMin="var(--lighter-brown)"
                  label="Flow Rate (g/s)"
                  max={4.0}
                  min={0.1}
                  onChange={setFlowRate}
                  step={0.1}
                  value={flowRate}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card brew-preview-card">
          <div className="brew-preview">
            <h2>Brew Summary</h2>
            <div className="brew-preview-settings">
              <div className="brew-detail">
                <h2>Brew Name:</h2>
                <input placeholder="My Brew" />
              </div>
              <div className="brew-details">
                <div className="brew-detail">
                  <h2>Temperature:</h2>
                  <p>{`${temperature}°C`}</p>
                </div>
                <div className="brew-detail">
                  <h2>Flow Rate:</h2>
                  <p>{`${flowRate.toFixed(1)}g/s`}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="brew-start-panel">
            <h2>Start Brew</h2>
            <button onClick={handleStartBrew} type="button">
              <FaPlay size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Brew
