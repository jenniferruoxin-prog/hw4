import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const MIN_PASSWORD = 8

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  function validate(): string {
    if (form.password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      return 'Password must include at least one letter and one number.'
    return ''
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    setError(problem)
    if (problem || mismatch) return // mismatch is shown under the confirm field
    setBusy(true)
    try {
      await signup({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      })
      navigate('/products')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password

  return (
    <section className="section auth">
      <form className="auth-card" onSubmit={submit}>
        <h1>Join the Bulldog family</h1>
        <p className="muted">Create an account to chat with our assistant and keep your history.</p>
        <div className="row">
          <label>
            First name
            <input autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} />
          </label>
          <label>
            Last name
            <input autoComplete="family-name" required value={form.lastName} onChange={set('lastName')} />
          </label>
        </div>
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={form.password}
            onChange={set('password')}
          />
          <small className="hint">At least {MIN_PASSWORD} characters, with a letter and a number.</small>
        </label>
        <label>
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={set('confirm')}
            aria-invalid={mismatch}
          />
          {mismatch && <small className="hint bad">Passwords do not match.</small>}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn primary full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  )
}
