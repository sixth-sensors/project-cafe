import Logo from '../components/logo/Logo'
import './Home.css'

const Home = () => {
  return (
    <main className="home">
      <div className="welcome-banner">
        <h1>Welcome to</h1>
        <Logo width={300} />
      </div>
    </main>
  )
}

export default Home
