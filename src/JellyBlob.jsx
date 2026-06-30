import { useEffect, useRef } from 'react'

/**
 * JellyBlob — a glossy 3D kawaii slime sticker with emotions + actions.
 *
 *  mood:  neutral | happy | sad | angry | surprised | love | sleepy | shy
 *  cue:   { type: 'shake' | 'bounce', id } — bump `id` to replay an action.
 *
 * The whole face + shine live inside the body group and are clipped to the
 * (wobbling) silhouette, so they read as one 3D form rather than a flat
 * overlay. The mouth is driven every frame so it opens on emotions/actions.
 */

const VB = 320
const CX = 160
const CY = 170
const WX = 104
const HY = 112
const N = 30
const MY = 185 // mouth baseline

const K = 0.08
const DAMP = 0.84
const TENSION = 0.16

const EYE = { rx: 22, ry: 26, dx: 35, cy: 150 }
const BROWY = EYE.cy - EYE.ry - 4

const smooth = (t) => t * t * (3 - 2 * t)

// mood -> colour shift + face config. hue=null keeps the base colour.
const MOODS = {
  neutral:   { hue: null, sat: 1,    eyes: 'normal', lid: 0,     brow: null },
  happy:     { hue: 138,  sat: 1,    eyes: 'happy',  lid: 0,     brow: null },
  sad:       { hue: 210,  sat: 0.9,  eyes: 'normal', lid: 0.15,  brow: 'sad', tear: true },
  angry:     { hue: 2,    sat: 1.2,  eyes: 'normal', lid: 0.18,  brow: 'angry' },
  surprised: { hue: 45,   sat: 1,    eyes: 'wide',   lid: -0.05, brow: 'up' },
  love:      { hue: 335,  sat: 1,    eyes: 'love',   lid: 0,     brow: null },
  sleepy:    { hue: null, sat: 0.55, eyes: 'normal', lid: 0.5,   brow: null },
  shy:       { hue: 330,  sat: 1,    eyes: 'closed', lid: 0,     brow: null, blushBig: true },
}

// mouth shape per mood: w=half-width, s=smile(+)/frown(-), o=resting openness
// o is small/zero so the mouth rests CLOSED (just a lip line); it opens on cues.
const MOUTHP = {
  neutral:   { w: 11, s: 0.7, o: 0 },
  happy:     { w: 15, s: 1.2, o: 3 },
  sad:       { w: 12, s: -0.8, o: 0 },
  angry:     { w: 14, s: -0.5, o: 2 },
  surprised: { w: 11, s: 0.0, o: 5 },
  love:      { w: 15, s: 1.2, o: 2 },
  sleepy:    { w: 9, s: 0.1, o: 0 },
  shy:       { w: 9, s: 0.6, o: 0 },
}

function buildShape() {
  const base = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const v = Math.sin(a)
    const widthScale = 1 + 0.16 * v
    base.push({ x: CX + Math.cos(a) * WX * widthScale, y: CY + Math.sin(a) * HY })
  }
  return base.map((p, i) => {
    const prev = base[(i - 1 + N) % N]
    const next = base[(i + 1) % N]
    let nx = next.y - prev.y
    let ny = -(next.x - prev.x)
    if (nx * (p.x - CX) + ny * (p.y - CY) < 0) { nx = -nx; ny = -ny }
    const len = Math.hypot(nx, ny) || 1
    return { bx: p.x, by: p.y, nx: nx / len, ny: ny / len, off: 0, v: 0, ang: (i / N) * Math.PI * 2 }
  })
}

function smoothClosed(pts) {
  const n = pts.length
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d + 'Z'
}

function lidPath(ex, ey, rx, ry, b) {
  const top = ey - ry - 6
  const bottom = ey - ry + b * (2 * ry + 2)
  const w = rx + 3
  return `M${ex - w},${top} H${ex + w} V${bottom} Q${ex},${bottom + 6} ${ex - w},${bottom} Z`
}

const sparkle = (x, y, s) =>
  `M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s} Z`

const heart = (cx, cy, s) =>
  `M${cx},${cy + 0.3 * s} C${cx - 0.62 * s},${cy - 0.2 * s} ${cx - 0.62 * s},${cy - 0.72 * s} ${cx},${cy - 0.34 * s} ` +
  `C${cx + 0.62 * s},${cy - 0.72 * s} ${cx + 0.62 * s},${cy - 0.2 * s} ${cx},${cy + 0.3 * s} Z`

export default function JellyBlob({ size = 300, hue = 265, mood = 'neutral', cue = null, className = '' }) {
  const svgRef = useRef(null)
  const bodyG = useRef(null)
  const pathRef = useRef(null)
  const shadeEl = useRef(null)
  const rimEl = useRef(null)
  const glowEl = useRef(null)
  const bodyClip = useRef(null)
  const lEye = useRef(null)
  const rEye = useRef(null)
  const lLid = useRef(null)
  const rLid = useRef(null)
  const tearRef = useRef(null)
  const lipRef = useRef(null)
  const mouthRef = useRef(null)
  const mouthClip = useRef(null)
  const tongueRef = useRef(null)

  const ref = useRef(null)
  if (!ref.current) {
    ref.current = {
      pts: buildShape(),
      px: 0, py: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      dragging: false, grabDX: 0, grabDY: 0,
      pointer: { x: CX, y: EYE.cy, inside: false },
      t: 0, pop: 0, mood,
      blinkWait: 900 + Math.random() * 2000, blinking: false, blinkClock: 0, queueDouble: false,
      action: null, actionClock: 0,
      tear: 0, mouthOpen: 0,
    }
  }
  const state = ref.current
  const face = MOODS[mood] || MOODS.neutral

  useEffect(() => { state.mood = mood; state.pop = 1; state.mouthOpen = 1 }, [mood])
  useEffect(() => {
    if (cue && cue.type) { state.action = cue.type; state.actionClock = 0; state.mouthOpen = 1 }
  }, [cue && cue.id])

  useEffect(() => {
    let raf
    let last = performance.now()

    const toVB = (cx, cy) => {
      const r = svgRef.current.getBoundingClientRect()
      return { x: ((cx - r.left) / r.width) * VB, y: ((cy - r.top) / r.height) * VB }
    }
    const poke = (vx, vy) => {
      for (const p of state.pts) {
        const x = state.px + p.bx + p.nx * p.off
        const y = state.py + p.by + p.ny * p.off
        p.v -= Math.max(0, 1 - Math.hypot(vx - x, vy - y) / 80) * 22
      }
    }
    const onDown = (e) => {
      const { x, y } = toVB(e.clientX, e.clientY)
      state.dragging = true; state.grabDX = state.px - x; state.grabDY = state.py - y
      poke(x, y); svgRef.current.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      const { x, y } = toVB(e.clientX, e.clientY)
      state.pointer = { x, y, inside: true }
      if (state.dragging) { state.tx = x + state.grabDX; state.ty = y + state.grabDY }
    }
    const onUp = () => { state.dragging = false; state.tx = 0; state.ty = 0 }
    const onLeave = () => { state.pointer.inside = false }

    const svg = svgRef.current
    svg.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    svg.addEventListener('pointerleave', onLeave)

    const CLOSE = 75, HOLD = 40, OPEN = 130

    const tick = (now) => {
      const dtMs = now - last
      const dt = Math.min(2, dtMs / 16.67)
      last = now
      state.t += dt

      // silhouette springs (gentle idle ripple — kept small so the face tracks it)
      const pts = state.pts
      for (let i = 0; i < N; i++) {
        const p = pts[i]
        const idle = Math.sin(state.t * 0.05 + p.ang * 3) * 1.4
        const a = pts[(i - 1 + N) % N].off, b = pts[(i + 1) % N].off
        p.v += (idle - p.off) * K + ((a + b) / 2 - p.off) * TENSION
        p.v *= DAMP
        p.off += p.v * dt
      }

      // body translation spring
      state.vx += (state.tx - state.px) * 0.20
      state.vy += (state.ty - state.py) * 0.20
      state.vx *= 0.78; state.vy *= 0.78
      state.px += state.vx * dt; state.py += state.vy * dt

      // action cues
      let ax = 0, ay = 0
      if (state.action) {
        state.actionClock += dtMs
        const tt = state.actionClock
        if (state.action === 'shake') {
          const k = Math.max(0, 1 - tt / 620)
          ax = Math.sin(tt * 0.045) * 16 * k
          if (tt > 620) state.action = null
        } else if (state.action === 'bounce') {
          const k = Math.max(0, 1 - tt / 820)
          ay = -Math.abs(Math.sin(tt * 0.012)) * 34 * k
          if (tt > 820) state.action = null
        }
      }

      // squash + breathe + pop (applied to the whole body+face together)
      const speed = Math.hypot(state.vx, state.vy)
      const dir = Math.atan2(state.vy, state.vx)
      const stretch = Math.min(0.20, speed * 0.012)
      state.pop *= 0.86
      const pop = 1 + state.pop * 0.12
      const breathe = 1 + Math.sin(state.t * 0.04) * 0.02
      const sx = (1 + stretch) * pop * breathe
      const sy = (1 - stretch * 0.7) * pop * (2 - breathe)

      const ring = pts.map((p) => ({ x: p.bx + p.nx * p.off, y: p.by + p.ny * p.off }))
      const d = smoothClosed(ring)
      pathRef.current.setAttribute('d', d)
      shadeEl.current.setAttribute('d', d)
      rimEl.current.setAttribute('d', d)
      glowEl.current.setAttribute('d', d)
      bodyClip.current.setAttribute('d', d)
      bodyG.current.setAttribute(
        'transform',
        `translate(${(state.px + ax).toFixed(2)} ${(state.py + ay).toFixed(2)}) ` +
          `rotate(${(dir * 180) / Math.PI} ${CX} ${CY}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) rotate(${(-dir * 180) / Math.PI} ${CX} ${CY})`
      )

      // blink
      let bl = 0
      if (!state.blinking) {
        state.blinkWait -= dtMs
        if (state.blinkWait <= 0) { state.blinking = true; state.blinkClock = 0 }
      } else {
        state.blinkClock += dtMs
        const c = state.blinkClock
        if (c < CLOSE) bl = smooth(c / CLOSE)
        else if (c < CLOSE + HOLD) bl = 1
        else if (c < CLOSE + HOLD + OPEN) bl = 1 - smooth((c - CLOSE - HOLD) / OPEN)
        else {
          state.blinking = false
          if (state.queueDouble) { state.queueDouble = false; state.blinkWait = 90 }
          else { state.blinkWait = 2200 + Math.random() * 3200; state.queueDouble = Math.random() < 0.25 }
        }
      }
      const baseLid = face.lid
      const effLid = baseLid + (1 - baseLid) * bl
      lLid.current?.setAttribute('d', lidPath(CX - EYE.dx, EYE.cy, EYE.rx, EYE.ry, effLid))
      rLid.current?.setAttribute('d', lidPath(CX + EYE.dx, EYE.cy, EYE.rx, EYE.ry, effLid))

      // gaze
      let gx = 0, gy = 0
      if (state.pointer.inside) {
        const dx = state.pointer.x - (CX + state.px)
        const dy = state.pointer.y - (EYE.cy + state.py)
        const m = Math.hypot(dx, dy) || 1
        gx = (dx / m) * Math.min(5, m * 0.05)
        gy = (dy / m) * Math.min(5, m * 0.05)
      }
      lEye.current?.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`)
      rEye.current?.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`)

      // --- mouth: rests closed (a small lip line), opens on emotions/actions
      state.mouthOpen *= 0.92
      const mp = MOUTHP[state.mood] || MOUTHP.neutral
      const openH = Math.max(0, mp.o + state.mouthOpen * 13)
      const w = mp.w
      const sd = mp.s * 5 // lip curve depth (smile = bulge down)
      // closed lip line (always visible) — a soft smile/frown
      lipRef.current.setAttribute('d', `M${CX - w},${MY} Q${CX},${(MY + sd).toFixed(1)} ${CX + w},${MY}`)
      // open cavity (fades in as it opens)
      const cw = w * 0.82
      const cav = `M${CX - cw},${MY - 0.5} Q${CX},${(MY + mp.s * 3).toFixed(1)} ${CX + cw},${MY - 0.5} Q${CX},${(MY + openH).toFixed(1)} ${CX - cw},${MY - 0.5} Z`
      const cavOp = Math.max(0, Math.min(1, (openH - 2) / 5))
      mouthRef.current.setAttribute('d', cav)
      mouthRef.current.setAttribute('opacity', cavOp.toFixed(2))
      mouthClip.current.setAttribute('d', cav)
      tongueRef.current.setAttribute('cx', CX)
      tongueRef.current.setAttribute('cy', (MY + openH * 0.5).toFixed(1))
      tongueRef.current.setAttribute('rx', (cw * 0.7).toFixed(1))
      tongueRef.current.setAttribute('ry', Math.max(1, openH * 0.32).toFixed(1))
      tongueRef.current.setAttribute('opacity', cavOp.toFixed(2))

      // tear (sad)
      if (tearRef.current) {
        state.tear += dt
        const range = 46
        const ty = (state.tear * 0.8) % range
        tearRef.current.setAttribute('cy', (EYE.cy + EYE.ry - 2 + ty).toFixed(2))
        tearRef.current.setAttribute('opacity', (1 - ty / range).toFixed(2))
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      svg.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      svg.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const gid = `body-${hue}`, eid = `eye-${hue}`, fid = `glow-${hue}`
  const sid = `shade-${hue}`, rgid = `rim-${hue}`, hid = `soft-${hue}`
  const bclip = `bclip-${hue}`, mclip = `mclip-${hue}`, mgrad = `mouth-${hue}`
  const lidCol = `hsl(${hue}, 88%, 72%)`
  const cheek = `hsla(${(hue + 70) % 360}, 100%, 75%, ${face.blushBig ? 0.75 : 0.55})`
  const dark = `hsla(${hue}, 45%, 32%, 0.9)`

  const lex = CX - EYE.dx, rex = CX + EYE.dx
  const escale = face.eyes === 'wide' ? 1.15 : 1

  const deg = face.hue == null ? 0 : face.hue - hue
  const filter = `hue-rotate(${deg}deg) saturate(${face.sat})`

  const OpenEye = ({ ex, eyeRef, lidRef, clipId }) => (
    <g>
      <clipPath id={clipId}>
        <ellipse cx={ex} cy={EYE.cy} rx={EYE.rx * escale + 3} ry={EYE.ry * escale + 3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g ref={eyeRef}>
          <ellipse cx={ex} cy={EYE.cy} rx={EYE.rx * escale} ry={EYE.ry * escale} fill={`url(#${eid})`} />
          <ellipse cx={ex - 7} cy={EYE.cy - 9} rx="7.5" ry="9.5" fill="#fff" />
          <circle cx={ex + 6} cy={EYE.cy + 8} r="3.6" fill="#fff" />
          <circle cx={ex + 8} cy={EYE.cy - 7} r="1.8" fill="#fff" opacity="0.8" />
        </g>
        <path ref={lidRef} d="" fill={lidCol} />
      </g>
    </g>
  )
  const renderEye = (ex, eyeRef, lidRef, clipId) => {
    if (face.eyes === 'happy')
      return <path d={`M${ex - 16},${EYE.cy + 3} Q${ex},${EYE.cy - 15} ${ex + 16},${EYE.cy + 3}`} fill="none" stroke="#23142e" strokeWidth="5" strokeLinecap="round" />
    if (face.eyes === 'closed')
      return <path d={`M${ex - 15},${EYE.cy - 1} Q${ex},${EYE.cy + 9} ${ex + 15},${EYE.cy - 1}`} fill="none" stroke="#23142e" strokeWidth="4.5" strokeLinecap="round" />
    if (face.eyes === 'love') return <path d={heart(ex, EYE.cy, 30)} fill="#ff3d77" />
    return <OpenEye ex={ex} eyeRef={eyeRef} lidRef={lidRef} clipId={clipId} />
  }

  // realistic tapered brow: a curved sliver, thicker in the middle.
  const browShape = (cx, outerX, outerY, midY, innerX, innerY) => {
    const mx = (outerX + innerX) / 2
    const th = 3.6 // half-thickness at the belly
    return (
      `M${outerX.toFixed(1)},${outerY.toFixed(1)} ` +
      `Q${mx.toFixed(1)},${(midY - th).toFixed(1)} ${innerX.toFixed(1)},${innerY.toFixed(1)} ` +
      `Q${mx.toFixed(1)},${(midY + th).toFixed(1)} ${outerX.toFixed(1)},${outerY.toFixed(1)} Z`
    )
  }
  const Brows = () => {
    if (!face.brow) return null
    let l, r
    if (face.brow === 'angry') {
      l = browShape(lex, lex - 17, BROWY - 2, BROWY + 3, lex + 12, BROWY + 11)
      r = browShape(rex, rex + 17, BROWY - 2, BROWY + 3, rex - 12, BROWY + 11)
    } else if (face.brow === 'sad') {
      l = browShape(lex, lex - 17, BROWY + 10, BROWY + 4, lex + 12, BROWY - 3)
      r = browShape(rex, rex + 17, BROWY + 10, BROWY + 4, rex - 12, BROWY - 3)
    } else { // surprised — raised arches
      l = browShape(lex, lex - 15, BROWY - 1, BROWY - 10, lex + 15, BROWY - 1)
      r = browShape(rex, rex - 15, BROWY - 1, BROWY - 10, rex + 15, BROWY - 1)
    }
    return <g fill={dark}><path d={l} /><path d={r} /></g>
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      style={{ touchAction: 'none', cursor: 'grab', overflow: 'visible', userSelect: 'none', filter, transition: 'filter 0.45s ease' }}
    >
      <defs>
        <radialGradient id={gid} cx="48%" cy="36%" r="74%">
          <stop offset="0%" stopColor={`hsl(${hue}, 100%, 88%)`} />
          <stop offset="46%" stopColor={`hsl(${hue}, 92%, 70%)`} />
          <stop offset="100%" stopColor={`hsl(${hue}, 82%, 46%)`} />
        </radialGradient>
        <radialGradient id={eid} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor={`hsl(${hue}, 45%, 26%)`} />
          <stop offset="100%" stopColor={`hsl(${hue}, 60%, 11%)`} />
        </radialGradient>
        {/* ambient occlusion — dark, bottom-weighted edges = round 3D volume */}
        <radialGradient id={sid} cx="50%" cy="34%" r="70%">
          <stop offset="0%" stopColor={`hsla(${hue}, 80%, 28%, 0)`} />
          <stop offset="58%" stopColor={`hsla(${hue}, 80%, 26%, 0)`} />
          <stop offset="84%" stopColor={`hsla(${hue}, 80%, 22%, 0.32)`} />
          <stop offset="100%" stopColor={`hsl(${hue}, 82%, 14%)`} />
        </radialGradient>
        {/* bright top rim light */}
        <linearGradient id={rgid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsla(${hue}, 100%, 95%, 0.7)`} />
          <stop offset="22%" stopColor={`hsla(${hue}, 100%, 92%, 0)`} />
          <stop offset="100%" stopColor={`hsla(${hue}, 100%, 92%, 0)`} />
        </linearGradient>
        {/* 3D mouth cavity */}
        <linearGradient id={mgrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d0b18" />
          <stop offset="45%" stopColor="#7a1f38" />
          <stop offset="100%" stopColor="#b83353" />
        </linearGradient>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="11" /></filter>
        <filter id={hid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5" /></filter>
        <clipPath id={bclip}><path ref={bodyClip} d="" /></clipPath>
        <clipPath id={mclip}><path ref={mouthClip} d="" /></clipPath>
      </defs>

      {/* ground shadow (stays put) */}
      <ellipse cx={CX} cy={CY + HY + 6} rx="84" ry="15" fill="rgba(0,0,0,0.22)" />

      <g ref={bodyG}>
        {/* outer glow (moves with body) */}
        <path ref={glowEl} d="" fill={`hsla(${hue}, 100%, 70%, 0.35)`} filter={`url(#${fid})`} />

        {/* body fill */}
        <path ref={pathRef} d="" fill={`url(#${gid})`} />

        {/* shine + shading, clipped to the body so it's part of the 3D form */}
        <g clipPath={`url(#${bclip})`}>
          <ellipse cx={CX} cy={CY + 46} rx="76" ry="54" fill={`hsl(${hue}, 100%, 86%)`} opacity="0.45" />
          <path ref={shadeEl} d="" fill={`url(#${sid})`} />
          <path ref={rimEl} d="" fill={`url(#${rgid})`} />
          {/* soft wet specular */}
          <ellipse cx={CX - 22} cy={CY - 70} rx="46" ry="26" fill="#fff" opacity="0.4" filter={`url(#${hid})`} transform="rotate(-18 138 100)" />
          <ellipse cx={CX - 34} cy={CY - 80} rx="13" ry="7" fill="#fff" opacity="0.85" transform="rotate(-18 126 90)" />
          <ellipse cx={CX + 48} cy={CY - 24} rx="8" ry="20" fill="#fff" opacity="0.22" filter={`url(#${hid})`} transform="rotate(24 208 146)" />
          {/* sparkles */}
          <g fill="#fff">
            <path d={sparkle(CX - 54, CY - 2, 6)} opacity="0.9" />
            <path d={sparkle(CX + 50, CY + 14, 4.5)} opacity="0.85" />
            <circle cx={CX + 28} cy={CY - 58} r="2.2" opacity="0.8" />
          </g>
        </g>

        {/* cheeks */}
        <ellipse cx={CX - 60} cy={EYE.cy + 30} rx={face.blushBig ? 20 : 17} ry={face.blushBig ? 13 : 11} fill={cheek} />
        <ellipse cx={CX + 60} cy={EYE.cy + 30} rx={face.blushBig ? 20 : 17} ry={face.blushBig ? 13 : 11} fill={cheek} />

        {/* eyes */}
        {renderEye(lex, lEye, lLid, `lc-${hue}`)}
        {renderEye(rex, rEye, rLid, `rc-${hue}`)}
        <Brows />
        {face.tear && <ellipse ref={tearRef} cx={lex + 4} cy={EYE.cy + EYE.ry} rx="5" ry="7" fill="#7ec8ff" />}

        {/* mouth — counter-rotate so it stays maroon regardless of mood hue-shift */}
        <g style={{ filter: `hue-rotate(${-deg}deg)` }}>
          <path ref={mouthRef} d="" fill={`url(#${mgrad})`} />
          <g clipPath={`url(#${mclip})`}>
            <ellipse ref={tongueRef} cx={CX} cy={MY + 6} rx="7" ry="3" fill="#ef7a93" />
          </g>
          {/* lip line — the resting closed mouth */}
          <path ref={lipRef} d="" fill="none" stroke="#9c2d4b" strokeWidth="3.4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
