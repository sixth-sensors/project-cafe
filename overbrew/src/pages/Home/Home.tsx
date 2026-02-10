import { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar/Navbar'
import { Page } from '../../components/Navbar/Navbar.types'
import type { NavLink } from '../../components/Navbar/Navbar.types'
import Brew from './Grids/Brew'
import Info from './Grids/Info'
import './Home.css'

const getPageFromHash = (): Page => {
  const hash = window.location.hash.slice(1) // Remove the '#'
  return hash === 'info' ? Page.Info : Page.Brew
}

const Home = () => {
  const [activePage, setActivePage] = useState<Page>(getPageFromHash())

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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

  const currentColors = links.find((link) => link.page === activePage)?.colors

  return (
    <main
      className="home"
      style={
        {
          backgroundColor: currentColors?.backgroundColor,
          '--card-bg': currentColors?.primaryColor,
          '--text-color': currentColors?.textColor,
        } as React.CSSProperties
      }
    >
      <div className="navbar-container">
        <Navbar activePage={activePage} links={links} />
      </div>
      <div className="content-wrapper">
        <div
          className="page-slide"
          style={{
            transform:
              activePage === Page.Brew ? 'translateX(0)' : 'translateX(-100%)',
          }}
        >
          <Brew />
        </div>
        <div
          className="page-slide"
          style={{
            transform:
              activePage === Page.Info ? 'translateX(0)' : 'translateX(100%)',
          }}
        >
          <Info />
        </div>
      </div>
    </main>
  )
}

export default Home
