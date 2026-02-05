import { useState } from 'react'
import Logo from '../components/logo/Logo'
import Navbar from '../components/navbar/Navbar'
import { Page } from '../components/navbar/Navbar.types'
import type { NavLink } from '../components/navbar/Navbar.types'
import './Home.css'

const Home = () => {
  const [activePage, setActivePage] = useState<Page>(Page.Brew)

  const links: NavLink[] = [
    {
      page: Page.Brew,
      label: 'Brew',
      colors: {
        primaryColor: 'var(--dark-brown)',
        secondaryColor: 'var(--light-brown)',
        backgroundColor: 'var(--lighter-brown)',
        textColor: 'var(--cream)',
      },
    },
    {
      page: Page.Info,
      label: 'Info',
      colors: {
        primaryColor: '#ffffff',
        secondaryColor: 'var(--dark-orange)',
        backgroundColor: 'var(--cream)',
        textColor: 'var(--dark-brown)',
      },
    },
  ]

  const currentLink = links.find((link) => link.page === activePage)
  const currentBackgroundColor =
    currentLink?.colors.backgroundColor || 'transparent'

  return (
    <main className="home" style={{ backgroundColor: currentBackgroundColor }}>
      <div className="navbar-container">
        <Navbar
          activePage={activePage}
          links={links}
          setActivePage={setActivePage}
        />
      </div>
      <div className="welcome-banner">
        <h1>Welcome to</h1>
        <Logo width={300} />
      </div>
    </main>
  )
}

export default Home
