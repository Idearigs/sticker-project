import { useState } from 'react'
import JellyBlob from './JellyBlob'

const SWATCHES = [
  { hue: 265, label: 'Grape' },
  { hue: 150, label: 'Mint' },
  { hue: 12, label: 'Coral' },
  { hue: 45, label: 'Gold' },
]
const MOODS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'love', 'sleepy', 'shy', 'thinking']

export default function App() {
  const [hue, setHue] = useState(150)
  const [mood, setMood] = useState('neutral')
  const [cue, setCue] = useState(null)
  const [speech, setSpeech] = useState('Going somewhere?')

  // form companion
  const [focus, setFocus] = useState(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')

  const fire = (type) => setCue({ type, id: Date.now() })
  const say = (m, text, c) => { setMood(m); setSpeech(text); if (c) fire(c) }
  const idle = () => { setMood('neutral'); setSpeech('Going somewhere?') }

  const formMood = focus === 'password' ? 'password' : 'neutral'
  // email: lean in toward the field (right). password: turn AWAY (left), eyes shut.
  const formGaze = focus === 'email' ? { x: 62, y: -4 } : focus === 'password' ? { x: -54, y: 2 } : null

  return (
    <main className="page">
      <h1 className="brand">Live Action Stickers</h1>

      <div className="modal-wrap">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />

        <div className="swatches">
          {SWATCHES.map((s) => (
            <button
              key={s.hue}
              className={`swatch ${s.hue === hue ? 'on' : ''}`}
              style={{ background: `hsl(${s.hue}, 80%, 62%)` }}
              title={s.label}
              onClick={() => setHue(s.hue)}
            />
          ))}
        </div>

        <div className="glass-card pop-in">
          <button className="close" onClick={() => say('surprised', 'Oh! Hi 👋', 'bounce')}>×</button>

          {speech && <div className="bubble" key={speech}>{speech}</div>}

          <div className="modal-blob">
            <JellyBlob size={184} hue={hue} mood={mood} cue={cue} />
          </div>

          <h2 className="title">Log Out?</h2>
          <p className="subtitle">You'll need to sign in again<br />to access your account.</p>

          <div className="actions">
            <button
              className="btn cancel"
              onMouseEnter={() => say('happy', 'Yay, stay with me!', 'bounce')}
              onMouseLeave={idle}
              onClick={() => say('love', 'Yay! 🎉', 'bounce')}
            >
              Cancel
            </button>
            <button
              className="btn logout"
              onMouseEnter={() => say('sad', "Aww, don't go…")}
              onMouseLeave={idle}
              onClick={() => say('sad', 'Okay… bye 😢', 'shake')}
            >
              Log Out
            </button>
          </div>
        </div>

        <div className="emotions">
          {MOODS.map((m) => (
            <button key={m} className={`chip ${m === mood ? 'on' : ''}`} onClick={() => { setMood(m); setSpeech('') }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Form companion */}
      <section className="companion">
        <h2 className="sec-title">Form companion</h2>
        <p className="lead">
          Pair the slime with a form and it reacts to the field in focus — it leans in and
          reads along as you type your email, then squeezes its eyes shut the moment you reach
          the password. Wired with the <code>gaze</code> prop and a closed-eye <code>password</code> mood.
        </p>

        <div className="form-card">
          <div className="form-blob">
            <JellyBlob size={170} hue={hue} mood={formMood} gaze={formGaze} />
          </div>
          <div className="fields">
            <label>Email</label>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Password</label>
            <input
              type="password"
              value={pw}
              placeholder="••••••••"
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
