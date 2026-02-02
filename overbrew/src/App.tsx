import Header from './components/header/Header'
import Logo from './components/logo/Logo'
import './App.css'

function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <div className="welcome-banner">
          <h1>Welcome to</h1>
          <Logo width={300} />
        </div>
      </main>
    </>
  )
}

export default App
