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

type SettingsPanel = 'settings' | 'chat'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

type AiChatResponse = {
  assistant_message: string
  inferred?: {
    temperature?: number | null
    flow_rate?: number | null
    quantity?: number | null
  }
  ready_to_brew?: boolean
  brew_started?: boolean
  brew_saved?: boolean
  brew_title?: string
  request_id?: string
  id?: number
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
  const [activeSettingsPanel, setActiveSettingsPanel] =
    useState<SettingsPanel>('settings')
  const [chatInput, setChatInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'seed-assistant',
      role: 'assistant',
      text: "Hi there! I'm Joe - your personal brew assistant. Tell me about the kind of coffee you want, and I'll help you craft the perfect brew!",
    },
  ])

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

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages((existing) => [...existing, message])
  }

  const handleSendAiMessage = async () => {
    if (!user || aiBusy || !chatInput.trim()) return

    const prompt = chatInput.trim()
    addChatMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
    })
    setChatInput('')
    setAiBusy(true)

    try {
      const response = (await apiFetch('/ai/chat', user, {
        method: 'POST',
        body: JSON.stringify({
          sender_id: SENDER_ID,
          type: 'ai_chat',
          session_id: `${user.uid}-brew`,
          user_id: user.uid,
          message: prompt,
        }),
      })) as AiChatResponse

      addChatMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text:
          response.assistant_message || 'I need a bit more detail to continue.',
      })

      const inferredTemperature =
        typeof response.inferred?.temperature === 'number'
          ? Math.round(response.inferred.temperature)
          : temperature
      const inferredFlowRate =
        typeof response.inferred?.flow_rate === 'number'
          ? Number(response.inferred.flow_rate.toFixed(1))
          : flowRate
      const inferredQuantity =
        typeof response.inferred?.quantity === 'number'
          ? Math.round(response.inferred.quantity)
          : quantity

      if (typeof response.inferred?.temperature === 'number') {
        setTemperature(inferredTemperature)
      }
      if (typeof response.inferred?.flow_rate === 'number') {
        setFlowRate(inferredFlowRate)
      }
      if (typeof response.inferred?.quantity === 'number') {
        setQuantity(inferredQuantity)
      }

      if ((response.brew_started || response.brew_saved) && response.id) {
        const newBrew: Brew = {
          id: String(response.id),
          title:
            response.brew_title ||
            brewName ||
            (response.brew_saved ? 'Saved AI Brew' : 'AI Brew'),
          settings: {
            temperature: inferredTemperature,
            flowRate: inferredFlowRate,
            quantity: inferredQuantity,
          },
          isFavorite: !!response.brew_saved,
          timestamp: new Date().toISOString(),
        }
        setBrews((currentBrews) => [newBrew, ...currentBrews])
        if (response.brew_started) {
          window.location.hash = '#info'
        }
      }
    } catch (error) {
      console.error('AI chat failed:', error)
      addChatMessage({
        id: `system-${Date.now()}`,
        role: 'system',
        text: 'AI chat is unavailable right now. Please try again.',
      })
    } finally {
      setAiBusy(false)
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
      <div
        className={`grid brew-right ${
          activeSettingsPanel === 'chat' ? 'chat-active' : ''
        }`}
      >
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
              <div className="settings-content-header">
                <h2>
                  {activeSettingsPanel === 'settings'
                    ? 'Brew Settings'
                    : 'AI Brew Assistant'}
                </h2>
                <div className="settings-panel-tabs" role="tablist">
                  <button
                    aria-selected={activeSettingsPanel === 'settings'}
                    className={
                      activeSettingsPanel === 'settings' ? 'active' : ''
                    }
                    onClick={() => setActiveSettingsPanel('settings')}
                    role="tab"
                    type="button"
                  >
                    Settings
                  </button>
                  <button
                    aria-selected={activeSettingsPanel === 'chat'}
                    className={activeSettingsPanel === 'chat' ? 'active' : ''}
                    onClick={() => setActiveSettingsPanel('chat')}
                    role="tab"
                    type="button"
                  >
                    Chat
                  </button>
                </div>
                <div />
              </div>

              {activeSettingsPanel === 'settings' ? (
                <div className="sliders-container">
                  <Slider
                    gradientMax="#F23232"
                    gradientMin="#BFFAFF"
                    label="Temperature (°C)"
                    max={96}
                    min={60}
                    onChange={setTemperature}
                    value={temperature}
                  />
                  <Slider
                    gradientMax="var(--dark-brown)"
                    gradientMin="var(--lighter-brown)"
                    label="Flow Rate (ml/s)"
                    max={20}
                    min={1}
                    onChange={setFlowRate}
                    value={flowRate}
                  />
                  <Slider
                    gradientMax="#000f93"
                    gradientMin="#BFFAFF"
                    label="Quantity (ml)"
                    max={1000}
                    min={30}
                    onChange={setQuantity}
                    step={1}
                    value={quantity}
                  />
                </div>
              ) : (
                <div className="ai-chat-panel">
                  <div className="ai-chat-hint">
                    Current settings: {temperature}°C at {flowRate.toFixed(1)}{' '}
                    ml/s
                  </div>
                  <div className="ai-chat-messages">
                    {chatMessages.map((message) => (
                      <div
                        className={`ai-chat-bubble ${message.role}`}
                        key={message.id}
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>
                  <div className="ai-chat-input-row">
                    <input
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleSendAiMessage()
                        }
                      }}
                      placeholder="e.g. Smooth but strong coffee at 92C and 7ml/s"
                      type="text"
                      value={chatInput}
                    />
                    <button
                      disabled={aiBusy || !chatInput.trim()}
                      onClick={() => void handleSendAiMessage()}
                      type="button"
                    >
                      {aiBusy ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
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
