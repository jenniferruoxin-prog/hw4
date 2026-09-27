import { Link } from 'react-router-dom'
import Bulldog from './Bulldog'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Bulldog size={56} title="" />
          <strong className="footer-brand">Campus Customs</strong>
          <p>Officially licensed Yale gear from our shop in New Haven.</p>
        </div>
        <div>
          <h4>Visit</h4>
          <p>57 Broadway<br />New Haven, CT 06511</p>
        </div>
        <div>
          <h4>Shop</h4>
          <Link to="/products">All products</Link>
          <Link to="/about">About us</Link>
          <Link to="/signup">Create account</Link>
        </div>
      </div>
      <p className="footer-note">© {new Date().getFullYear()} Campus Customs · Officially licensed Yale merchandise · Boola Boola!</p>
    </footer>
  )
}
