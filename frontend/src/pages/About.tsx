import { Link } from 'react-router-dom'

export default function About() {
  return (
    <section className="section about">
      <div className="page-head">
        <p className="eyebrow">About Campus Customs</p>
        <h1>Local shop, true Yale blue</h1>
      </div>

      <div className="about-grid">
        <div>
          <p>
            Campus Customs is a New Haven shop at 57 Broadway, just a few steps from campus. We
            make officially licensed Yale apparel for everyone in the Bulldog family: students
            counting down to finals, alumni coming back for Reunion, and parents who want to show
            where their kid goes to school.
          </p>
          <p>
            We care about quality you can feel. That means soft fleece for long winters, sturdy
            prints that last through many washes, and designs for all 14 residential colleges,
            varsity teams, graduate schools and every class year.
          </p>
          <p>
            Whether you're gearing up for The Game or looking for a gift, we want shopping with us
            to feel like stopping by a friend's store. Have a question about fit, stock or what to
            buy? Our chat assistant in the corner is happy to help.
          </p>
          <Link to="/products" className="btn primary">
            Browse the shop
          </Link>
        </div>

        <ul className="values">
          <li>
            <strong>Officially licensed</strong>
            <span>Authentic Yale marks on every piece.</span>
          </li>
          <li>
            <strong>Rooted in New Haven</strong>
            <span>A local team that knows campus traditions.</span>
          </li>
          <li>
            <strong>Made for every Eli</strong>
            <span>Colleges, sports, schools and class years.</span>
          </li>
          <li>
            <strong>Honest answers</strong>
            <span>Real prices and real stock, straight from our inventory.</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
