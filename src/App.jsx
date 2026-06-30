import { useState } from 'react'
import JellyBlob from './JellyBlob'

const PASSWORD = 'claude'
const MOODS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'love', 'sleepy', 'shy']

export default function App() {
  const [mood, setMood] = useState('neutral')
  const [cue, setCue] = useState(null)
  const [pw, setPw] = useState('')
  const [status, setStatus] = useState(null) // 'ok' | 'bad' | null
  const [locked, setLocked] = useState(false)

  const fire = (type) => setCue({ type, id: Date.now() })

  const submit = (e) => {
    e.preventDefault()
    if (locked) return
    if (pw === PASSWORD) {
      setStatus('ok')
      setMood('happy')
      fire('bounce')
      setLocked(true)
    } else {
      setStatus('bad')
      setMood('angry')
      fire('shake')
      setLocked(true)
      setTimeout(() => {
        setMood('neutral')
        setStatus(null)
        setLocked(false)
      }, 1700)
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>Live Action Stickers</h1>
        <p>
          A glossy slime mascot with <strong>emotions &amp; actions</strong>. It reacts when
          your password is wrong — turning red, frowning and shaking — and celebrates when it's right.
        </p>
      </header>

      <section className="stage">
        <div className="big">
          <JellyBlob size={300} hue={265} mood={status === 'bad' ? 'angry' : mood} cue={cue} />
        </div>
      </section>

      {/* Password demo */}
      <section className="login">
        <form onSubmit={submit}>
          <label>Try a password <em>(it's “{PASSWORD}”)</em></label>
          <div className="row">
            <input
              type="password"
              value={pw}
              placeholder="enter password…"
              onChange={(e) => setPw(e.target.value)}
              onFocus={() => { if (!locked) setMood('shy') }}
              onBlur={() => { if (!locked && status !== 'bad') setMood('neutral') }}
            />
            <button type="submit">Unlock</button>
          </div>
          <p className={`msg ${status || ''}`}>
            {status === 'ok' && '🎉 Access granted!'}
            {status === 'bad' && '❌ Wrong password — try again!'}
            {!status && 'Focus the field and it’ll shyly cover its eyes 🙈'}
          </p>
        </form>
      </section>

      {/* Emotion playground */}
      <section className="sheet">
        <h2>Emotions &amp; actions</h2>
        <div className="chips">
          {MOODS.map((m) => (
            <button key={m} className={m === mood ? 'chip on' : 'chip'} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="chips">
          <button className="chip act" onClick={() => fire('shake')}>shake</button>
          <button className="chip act" onClick={() => fire('bounce')}>bounce</button>
        </div>
      </section>

      <footer className="foot">
        100% custom · React + Vite · spring-deformed SVG on <code>requestAnimationFrame</code>
      </footer>
    </main>
  )
}
