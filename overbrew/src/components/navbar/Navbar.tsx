import type { MouseEvent } from 'react'
import type { Page, NavbarProps } from './Navbar.types'
import './Navbar.css'

const Navbar = ({ links, activePage, setActivePage }: NavbarProps) => {
  const currentColors =
    links.find((link) => link.page === activePage)?.colors ?? links[0]?.colors

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, page: Page) => {
    e.preventDefault()
    setActivePage(page)
  }

  return (
    <div
      className="navbar-wrapper"
      style={
        {
          '--navbar-bg': currentColors.primaryColor,
          '--pill-bg': currentColors.secondaryColor,
          '--text-color': currentColors.textColor,
          '--background-color': currentColors.backgroundColor,
        } as React.CSSProperties
      }
    >
      <div className="bubble active-bubble" />
      <div className="bubble hover-bubble" />
      <nav className="navbar">
        {links.map((link) => (
          <a
            className={activePage === link.page ? 'active' : ''}
            href="#"
            key={link.page}
            onClick={(e) => handleClick(e, link.page)}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  )
}

export default Navbar
