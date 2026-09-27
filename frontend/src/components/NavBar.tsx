import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Bulldog from './Bulldog'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products', end: false },
  { to: '/about', label: 'About Us', end: true },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const close = () => setOpen(false)

  async function onLogout() {
    close()
    await logout()
    navigate('/')
  }
  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <header className="header">
      <div className="announcement">Officially licensed Yale merchandise · 57 Broadway, New Haven</div>
      <nav className="nav">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark" aria-hidden="true">
            <Bulldog size={44} title="" />
          </span>
          <span className="brand-text">
            <strong>Campus Customs</strong>
            <small>Yale Bulldog Blue · Est. New Haven</small>
          </span>
        </Link>

        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          ☰
        </button>

        <div className={`nav-links${open ? ' open' : ''}`}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={close}>
              {l.label}
            </NavLink>
          ))}
          <span className="nav-spacer" />
          {user ? (
            <>
              <span className="nav-user">Hi, {user.first_name}</span>
              <button className="nav-link nav-button" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass} onClick={close}>
                Log in
              </NavLink>
              <NavLink to="/signup" className="nav-cta" onClick={close}>
                Create account
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
