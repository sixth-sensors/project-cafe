import './Grids.css'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { apiFetch, SENDER_ID } from '../../../lib/api'
import { useBrew } from '../../../hooks/useBrew'
import BrewButton, {
  SkeletonBrewButton,
} from '../../../components/BrewButton/BrewButton'
import Slider from '../../../components/Slider/Slider'
import { FaPlay, FaSignal, FaWifi } from 'react-icons/fa'

export type BrewSettings = {
  temperature: number
  flowRate: number
  quantity: number
}

type Brew = {
  id: string
  title: string
  settings: BrewSettings
  isFavorite: boolean
  timestamp: string
}

const Brew = () => {
  const { user } = useAuth()
  const { brewActive } = useBrew()
  const [temperature, setTemperature] = useState(60)
  const [flowRate, setFlowRate] = useState(1)
  const [quantity, setQuantity] = useState(30)
  const [brewName, setBrewName] = useState('')
  const [brews, setBrews] = useState<Brew[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let isMounted = true

    const fetchBrews = async () => {
      try {
        setIsLoading(true)
        const [recentsRes, favouritesRes] = await Promise.all([
          apiFetch(`/fetch-recents/${user.uid}`, user).catch(() => ({
            brews: [],
          })),
          apiFetch(`/fetch-favourites/${user.uid}`, user).catch(() => ({
            favourites: [],
          })),
        ])

        if (isMounted) {
          const recents = recentsRes.brews || []
          const favourites = favouritesRes.favourites || []

          interface BrewItemProps {
            id: string | number
            title?: string
            temperature: number
            flow_rate: number
            quantity?: number
            favourite?: boolean | number
            start_timestamp: string
          }

          const allBrewsMap = new Map<string, Brew>()

          recents.forEach((item: BrewItemProps) => {
            allBrewsMap.set(String(item.id), {
              id: String(item.id),
              title: item.title || 'Recent Brew',
              settings: {
                temperature: item.temperature,
                flowRate: item.flow_rate,
                quantity: item.quantity ?? 30,
              },
              isFavorite: Boolean(item.favourite),
              timestamp: item.start_timestamp,
            })
          })

          favourites.forEach((item: BrewItemProps) => {
            allBrewsMap.set(String(item.id), {
              id: String(item.id),
              title: item.title || 'Favourite Brew',
              settings: {
                temperature: item.temperature,
                flowRate: item.flow_rate,
                quantity: item.quantity ?? 30,
              },
              isFavorite: true,
              timestamp: item.start_timestamp,
            })
          })

          setBrews(Array.from(allBrewsMap.values()))
        }
      } catch (error) {
        console.error('Failed to fetch brews:', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchBrews()

    return () => {
      isMounted = false
    }
  }, [user])

  const sortedBrews = [...brews].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const favouriteBrews = sortedBrews.filter((brew) => brew.isFavorite)
  const recentBrews = sortedBrews.filter((brew) => !brew.isFavorite)

  const handleToggleFavorite = async (id: string) => {
    const brew = brews.find((b) => b.id === id)
    if (!brew || !user) return

    const newFavoriteStatus = !brew.isFavorite

    setBrews((currentBrews) =>
      currentBrews.map((b) =>
        b.id === id
          ? {
              ...b,
              isFavorite: newFavoriteStatus,
            }
          : b
      )
    )

    try {
      await apiFetch('/favourite_brew', user, {
        method: 'PUT',
        body: JSON.stringify({
          sender_id: SENDER_ID,
          type: 'favourite',
          brew_id: parseInt(id, 10),
          user_id: user.uid,
          toggle_favourite: newFavoriteStatus,
        }),
      })
    } catch (error) {
      console.error(
        'Failed to update favorite status: ',
        error,
        'Reverting change.'
      )
      setBrews((currentBrews) =>
        currentBrews.map((b) =>
          b.id === id
            ? {
                ...b,
                isFavorite: !newFavoriteStatus,
              }
            : b
        )
      )
    }
  }

  const handleBrewSelect = (settings: BrewSettings, title: string) => {
    setTemperature(settings.temperature)
    setFlowRate(settings.flowRate)
    setQuantity(settings.quantity)
    setBrewName(title)
  }

  const handleStartBrew = async () => {
    if (!user) return

    try {
      const response = await apiFetch('/brew', user, {
        method: 'POST',
        body: JSON.stringify({
          sender_id: SENDER_ID,
          type: 'brew',
          user_id: user.uid,
          title: brewName || 'My Brew',
          temperature,
          flow_rate: flowRate,
          quantity,
        }),
      })

      if (response && response.id) {
        const newBrew: Brew = {
          id: String(response.id),
          title: brewName || 'My Brew',
          settings: {
            temperature,
            flowRate,
            quantity,
          },
          isFavorite: false,
          timestamp: new Date().toISOString(),
        }
        setBrews((currentBrews) => [newBrew, ...currentBrews])
      }

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

          {isLoading ? (
            <>
              {[...Array(5)].map((_, index) => (
                <SkeletonBrewButton key={index} />
              ))}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      <div className="grid brew-right">
        <div className="card brew-settings">
          <div className="brew-settings-screen">
            <span className="settings-header">
              <p>BrewNet</p>
              <div>
                <FaWifi size={13} />
                <FaSignal size={13} />
              </div>
            </span>
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
                  value={temperature}
                />
                <Slider
                  gradientMax="var(--dark-brown)"
                  gradientMin="var(--lighter-brown)"
                  label="Flow Rate (ml/s)"
                  max={25}
                  min={1}
                  onChange={setFlowRate}
                  value={flowRate}
                />
                <Slider
                  gradientMax="#000f93"
                  gradientMin="#BFFAFF"
                  label="Quantity (ml)"
                  max={1400}
                  min={30}
                  onChange={setQuantity}
                  step={1}
                  value={quantity}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card brew-preview-card">
          <div className="brew-preview">
            <div className="brew-preview-header">
              <h2>Brew Name:</h2>
              <input
                onChange={(e) => setBrewName(e.target.value)}
                placeholder="My Brew"
                value={brewName}
              />
            </div>
            <div className="brew-preview-settings">
              <div className="brew-details">
                <div className="brew-detail">
                  <h2>Temperature:</h2>
                  <p>{`${temperature}°C`}</p>
                </div>
                <div className="brew-detail">
                  <h2>Flow Rate:</h2>
                  <p>{`${flowRate.toFixed(1)}ml/s`}</p>
                </div>
                <div className="brew-detail">
                  <h2>Quantity:</h2>
                  <p>{`${quantity}ml`}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="brew-start-panel">
            <h2>Start Brew</h2>
            <button
              disabled={brewActive}
              onClick={handleStartBrew}
              type="button"
            >
              <FaPlay size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Brew
