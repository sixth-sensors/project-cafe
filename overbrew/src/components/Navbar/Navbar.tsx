import type { NavbarProps } from './Navbar.types'
import './Navbar.css'

const Navbar = ({ links, activePage }: NavbarProps) => {
  const currentColors =
    links.find((link) => link.page === activePage)?.colors ?? links[0]?.colors

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
            href={`#${link.page}`}
            key={link.page}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  )
}

export default Navbar
