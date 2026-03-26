import './BrewButton.css'
import type { BrewSettings } from '../../pages/Home/Grids/Brew'
import { FaStar } from 'react-icons/fa'

type BrewButtonProps = {
  title: string
  settings: BrewSettings
  timestamp: string
  isFavorite: boolean
  onClick: (settings: BrewSettings, title: string) => void
  onToggleFavorite: () => void
}

export const SkeletonBrewButton = () => (
  <div className="brew-button-wrapper skeleton-wrapper">
    <div className="skeleton-box main-box" />
  </div>
)

const BrewButton = ({
  title,
  settings,
  timestamp,
  isFavorite,
  onClick,
  onToggleFavorite,
}: BrewButtonProps) => {
  const formattedTimestamp = new Date(timestamp).toLocaleString()

  return (
    <div className="brew-button-wrapper">
      <div className="brew-button-container">
        <button
          className="brew-button"
          onClick={() => onClick(settings, title)}
          type="button"
        >
          <div className="brew-button-content">
            <h2>{title}</h2>
            <p>{`${settings.temperature}°C - ${settings.flowRate.toFixed(1)}ml/s - ${settings.quantity}ml`}</p>
            <p className="brew-button-timestamp">{formattedTimestamp}</p>
          </div>
        </button>
      </div>
      <button className="fav-button" onClick={onToggleFavorite} type="button">
        <FaStar
          color={isFavorite ? 'var(--yellow)' : 'var(--dark-grey)'}
          size={32}
        />
      </button>
    </div>
  )
}

export default BrewButton
