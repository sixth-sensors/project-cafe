import { useState, useEffect } from 'react'
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
      <Navbar
        activePage={activePage}
        links={links}
        setActivePage={setActivePage}
      />
      <div className="content-wrapper">
        {activePage === Page.Brew && (
          <div className="grid brew-content">
            <div className="card">Card 1</div>
            <div className="grid brew-right">
              <div className="card">Card 2</div>
              <div className="card">Card 3</div>
            </div>
          </div>
        )}
        {activePage === Page.Info && (
          <div className="grid info-content">
            <div className="card">Card 1</div>
            <div className="grid info-bottom">
              <div className="card">Card 2</div>
              <div className="card">Card 3</div>
              <div className="card">Card 4</div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default Home
