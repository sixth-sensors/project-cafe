import './BrewButton.css'

type BrewButtonProps = {
  title: string
  details: string
  timestamp: string
  isFavorite: boolean
  onToggleFavorite: () => void
}

const BrewButton = ({
  title,
  details,
  timestamp,
  isFavorite,
  onToggleFavorite,
}: BrewButtonProps) => {
  const formattedTimestamp = new Date(timestamp).toLocaleString()

  return (
    <div className="brew-button-wrapper">
      <div className="brew-button-container">
        <button className="brew-button">
          <div className="brew-button-content">
            <h2>{title}</h2>
            <p>{details}</p>
            <p className="brew-button-timestamp">{formattedTimestamp}</p>
          </div>
        </button>
      </div>
      <input
        className="fav-button"
        type="checkbox"
        checked={isFavorite}
        onChange={onToggleFavorite}
      />
    </div>
  )
}

export default BrewButton
