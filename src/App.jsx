import { useState } from 'react'
import JellyBlob from './JellyBlob'

const SWATCHES = [
  { hue: 265, label: 'Grape' },
  { hue: 150, label: 'Mint' },
  { hue: 12, label: 'Coral' },
  { hue: 45, label: 'Gold' },
]
const MOODS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'love', 'sleepy', 'shy']

export default function App() {
  const [hue, setHue] = useState(150)
  const [mood, setMood] = useState('neutral')
  const [cue, setCue] = useState(null)
  const [speech, setSpeech] = useState('Going somewhere?')

  const fire = (type) => setCue({ type, id: Date.now() })
  const say = (m, text, c) => { setMood(m); setSpeech(text); if (c) fire(c) }
  const idle = () => { setMood('neutral'); setSpeech('Going somewhere?') }

  return (
    <main className="page">
      <h1 className="brand">Live Action Stickers</h1>

      <div className="modal-wrap">
        {/* colour orbs behind the glass so the blur has something to refract */}
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />

        {/* colour swatches */}
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

        {/* liquid-glass card */}
        <div className="glass-card">
          <button className="close" onClick={() => say('surprised', 'Oh! Hi 👋', 'bounce')}>×</button>

          <div className="bubble">{speech}</div>

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

        {/* tiny emotion playground */}
        <div className="emotions">
          {MOODS.map((m) => (
            <button key={m} className={`chip ${m === mood ? 'on' : ''}`} onClick={() => { setMood(m); setSpeech('') }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
