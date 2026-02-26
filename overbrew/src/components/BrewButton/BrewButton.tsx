import './BrewButton.css'

const BrewButton = ({ title, details }: { title: string; details: string }) => {
  return (
    <div className="brew-button-wrapper">
      <div className="brew-button-container">
        <button className="brew-button">
          <div className="brew-button-content">
            <h2>{title}</h2>
            <p>{details}</p>
          </div>
        </button>
      </div>
      <input className="fav-button" type="checkbox" />
    </div>
  )
}

export default BrewButton
