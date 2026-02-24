import './Grids.css'
import { useAuth } from '../../../hooks/useAuth'
import { apiFetch } from '../../../lib/api'

const Brew = () => {
  const { user } = useAuth()

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
      <div className="card">Card 1</div>
      <div className="grid brew-right">
        <div className="card">Card 2</div>
        <div className="card">
          <button onClick={handleStartBrew} type="button">
            Start Mock Brew
          </button>
        </div>
      </div>
    </div>
  )
}

export default Brew
