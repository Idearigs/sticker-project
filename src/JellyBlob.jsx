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

const EYE = { rx: 21, ry: 28, dx: 34, cy: 147 }
const BROWY = EYE.cy - EYE.ry - 4

const smooth = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

// mood -> colour shift + face config. hue=null keeps the base colour.
const MOODS = {
  // tilt: eyelid slope — inner-corner-down (angry glare) is negative,
  // outer-corner-down (sad droop) is positive. gy: resting gaze bias (down = +).
  neutral:   { hue: null, sat: 1,    eyes: 'normal', lid: 0,     brow: null,    tilt: 0,  gy: 0 },
  happy:     { hue: 138,  sat: 1,    eyes: 'happy',  lid: 0,     brow: null },
  sad:       { hue: 210,  sat: 0.9,  eyes: 'normal', lid: 0.34,  brow: 'sad',   tilt: 8,  gy: 5, tear: true },
  angry:     { hue: 2,    sat: 1.2,  eyes: 'normal', lid: 0.30,  brow: 'angry', tilt: -10, gy: 3 },
  surprised: { hue: 45,   sat: 1,    eyes: 'wide',   lid: -0.08, brow: 'up',    tilt: 0,  gy: -1 },
  love:      { hue: 335,  sat: 1,    eyes: 'love',   lid: 0,     brow: null },
  sleepy:    { hue: null, sat: 0.55, eyes: 'normal', lid: 0.62,  brow: null,    tilt: 0,  gy: 4 },
  shy:       { hue: 330,  sat: 1,    eyes: 'closed', lid: 0,     brow: null, blushBig: true },
  // squeezed-shut eyes for "not peeking at your password" — keeps base colour
  password:  { hue: null, sat: 1,    eyes: 'happy',  lid: 0,     brow: null, blushBig: true },
  // pondering — eyes glance up, one brow up, mouth pursed, hand to chin
  thinking:  { hue: null, sat: 1,    eyes: 'normal', lid: 0.14,  brow: 'up',    tilt: -3, gy: 0 },
}

// mouth shape per mood: w=half-width, s=smile(+)/frown(-), o=resting openness
// o is small/zero so the mouth rests CLOSED (just a lip line); it opens on cues.
const MOUTHP = {
  neutral:   { w: 11, s: 0.7, o: 0 },
  happy:     { w: 15, s: 1.2, o: 3 },
  sad:       { w: 12, s: -0.8, o: 0 },
  angry:     { w: 14, s: -0.5, o: 2 },
  surprised: { w: 14, s: 0.0, o: 26 },
  love:      { w: 15, s: 1.2, o: 2 },
  sleepy:    { w: 9, s: 0.1, o: 0 },
  shy:       { w: 9, s: 0.6, o: 0 },
  password:  { w: 10, s: 0.7, o: 0 },
  thinking:  { w: 8, s: 0.2, o: 0 },
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

// Realistic upper eyelid: a skin flap whose LEADING edge is a soft downward
// arc (draping over the round eyeball), sweeping from above the eye (open) to
// below it (closed). Returns the fill flap + the lash-line edge to stroke.
function lidGeom(ex, ey, rx, ry, b, tilt = 0) {
  const top = ey - ry - 9
  const w = rx + 4
  const midY = ey - ry - 2 + b * (2 * ry + 6) // travels top -> below eye
  const lY = midY - tilt // left corner of the leading edge
  const rY = midY + tilt // right corner
  const cY = (lY + rY) / 2 + ry * 0.5 // control point dips below the corners
  const edge =
    `M${(ex - w).toFixed(1)},${lY.toFixed(1)} ` +
    `Q${ex.toFixed(1)},${cY.toFixed(1)} ${(ex + w).toFixed(1)},${rY.toFixed(1)}`
  const fill =
    `M${(ex - w).toFixed(1)},${top.toFixed(1)} H${(ex + w).toFixed(1)} ` +
    `V${rY.toFixed(1)} Q${ex.toFixed(1)},${cY.toFixed(1)} ${(ex - w).toFixed(1)},${lY.toFixed(1)} Z`
  return { fill, edge }
}

const sparkle = (x, y, s) =>
  `M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s} Z`

const heart = (cx, cy, s) =>
  `M${cx},${cy + 0.3 * s} C${cx - 0.62 * s},${cy - 0.2 * s} ${cx - 0.62 * s},${cy - 0.72 * s} ${cx},${cy - 0.34 * s} ` +
  `C${cx + 0.62 * s},${cy - 0.72 * s} ${cx + 0.62 * s},${cy - 0.2 * s} ${cx},${cy + 0.3 * s} Z`

export default function JellyBlob({ size = 300, hue = 265, mood = 'neutral', cue = null, gaze = null, className = '' }) {
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
  const lLash = useRef(null)
  const rLash = useRef(null)
  const tearRef = useRef(null)
  const lipRef = useRef(null)
  const mouthRef = useRef(null)
  const mouthClip = useRef(null)
  const tongueRef = useRef(null)
  const lPaw = useRef(null)
  const rPaw = useRef(null)
  const thoughtRef = useRef(null)
  const thoughtTxt = useRef(null)
  const orbFx = useRef(null)
  const sparkFx = useRef([])
  const heartFx = useRef([])
  const zzzFx = useRef([])
  const steamFx = useRef([])
  const sweatFx = useRef(null)

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
      gaze: null, leanX: 0, leanY: 0, cover: 0,
      armLX: 0, armLY: 0, armLR: 0, armRX: 0, armRY: 0, armRR: 0,
    }
  }
  const state = ref.current
  const face = MOODS[mood] || MOODS.neutral
  state.gaze = gaze // { x, y } target direction the blob looks/leans toward

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

      // per-mood body language — each emotion moves differently
      const T = state.t
      let mbx = 0, mby = 0, msx = 1, msy = 1
      switch (state.mood) {
        case 'happy': {            // bouncy hops with squash-and-stretch
          const h = Math.abs(Math.sin(T * 0.11))
          mby = -h * 13; msx = 1 + (1 - h) * 0.06 - h * 0.05; msy = 1 - (1 - h) * 0.06 + h * 0.05
          break
        }
        case 'angry': {            // trembling with rage
          mbx = (Math.random() - 0.5) * 3.4; mby = (Math.random() - 0.5) * 2.4
          msx = 1 + Math.sin(T * 0.22) * 0.02; msy = 1 - Math.sin(T * 0.22) * 0.02
          break
        }
        case 'sad': {              // slumps down, sinks and deflates
          mby = 8 + Math.sin(T * 0.03) * 1.5; msx = 1.03; msy = 0.94
          break
        }
        case 'surprised': {        // startled jitter
          mbx = Math.sin(T * 0.6) * 1.4; mby = Math.sin(T * 0.52) * 1.1
          break
        }
        case 'love': {             // heartbeat throb
          const b = Math.pow(Math.abs(Math.sin(T * 0.06)), 0.4)
          msx = 1 + b * 0.05; msy = 1 + b * 0.05; mby = -b * 2
          break
        }
        case 'sleepy': {           // slow heavy breathing + gentle nod
          const br = Math.sin(T * 0.02)
          msx = 1 + br * 0.035; msy = 1 - br * 0.03; mby = Math.abs(br) * 3
          break
        }
        case 'shy': {              // bashful side-to-side fidget
          mbx = Math.sin(T * 0.05) * 5
          break
        }
      }
      const sx = (1 + stretch) * pop * breathe * msx
      const sy = (1 - stretch * 0.7) * pop * (2 - breathe) * msy

      // thinking sequence: 6 beats (~1.15s each) looping —
      // ponder · ponder+bubble · ponder · 💡idea · ✨aha · ✨resolved
      const thinking = state.mood === 'thinking'
      state.thinkClock = thinking ? (state.thinkClock ?? 0) + dtMs : 0
      const tphase = thinking ? Math.floor(state.thinkClock / 1150) % 6 : -1

      // lean toward the gaze target (form companion "lean-in")
      const gz = state.gaze
      let ltx = gz ? Math.max(-22, Math.min(22, gz.x * 0.32)) : 0
      let lty = gz ? Math.max(-12, Math.min(12, gz.y * 0.2)) : 0
      if (thinking) { ltx = Math.sin(T * 0.024) * 15; lty = 3 } // gentle pondering rock
      state.leanX += (ltx - state.leanX) * 0.12
      state.leanY += (lty - state.leanY) * 0.12
      const lean = state.leanX * 0.5 // degrees of body tilt

      // --- hands: each emotion strikes a pose (arms raise, cover, tremble…)
      // target offsets from the resting side positions, lerped for smoothness,
      // with a per-frame overlay (wave / tremble / fidget) on top.
      let alx = 0, aly = 0, alr = 0, arx = 0, ary = 0, arr = 0
      if (state.mood === 'password') {          // both hands up over the eyes
        alx = 79; aly = -40; alr = -16
        arx = -79; ary = -40; arr = 16
      } else if (state.mood === 'thinking') {
        if (tphase === 1) {                     // hands clasped on the tummy
          alx = 70; aly = 12; alr = 38; arx = -70; ary = 12; arr = -38
        } else if (tphase === 2) {              // left hand up to the chin
          alx = 80; aly = -6; alr = -70
        } else if (tphase === 3) {              // both hands together — idea!
          alx = 62; aly = 2; alr = 42; arx = -62; ary = 2; arr = -42
        } else if (tphase >= 4) {               // relaxed, one hand to the cheek
          arx = -72; ary = -2; arr = 60
        } else {                                // right hand up to the chin
          arx = -80; ary = -6; arr = 70
        }
      } else {
        const p =
          state.mood === 'happy'     ? { dx: 8,  dy: -48, rot: -44 } : // arms up cheering
          state.mood === 'surprised' ? { dx: 24, dy: -40, rot: -58 } : // hands to face
          state.mood === 'love'      ? { dx: 30, dy: -18, rot: -28 } : // hands to cheeks
          state.mood === 'angry'     ? { dx: 18, dy: -8,  rot: -24 } : // fists up
          state.mood === 'sad'       ? { dx: -2, dy: 16,  rot: 16 }  : // arms droop
          state.mood === 'sleepy'    ? { dx: 0,  dy: 12,  rot: 10 }  :
          state.mood === 'shy'       ? { dx: 32, dy: -28, rot: -46 } : // hands near face
                                       { dx: 0,  dy: 0,   rot: 0 }
        alx = p.dx; aly = p.dy; alr = p.rot
        arx = -p.dx; ary = p.dy; arr = -p.rot
      }
      state.armLX += (alx - state.armLX) * 0.14
      state.armLY += (aly - state.armLY) * 0.14
      state.armLR += (alr - state.armLR) * 0.14
      state.armRX += (arx - state.armRX) * 0.14
      state.armRY += (ary - state.armRY) * 0.14
      state.armRR += (arr - state.armRR) * 0.14

      // per-frame overlay motion
      let lwx = 0, lwy = 0, lwr = 0, rwx = 0, rwy = 0, rwr = 0
      switch (state.mood) {
        case 'happy':                            // waving both hands
          lwr = Math.sin(T * 0.3) * 16; rwr = -Math.sin(T * 0.3) * 16
          lwy = rwy = Math.sin(T * 0.3) * -3
          break
        case 'angry':                            // fists shaking
          lwx = (Math.random() - 0.5) * 4; lwy = (Math.random() - 0.5) * 3
          rwx = (Math.random() - 0.5) * 4; rwy = (Math.random() - 0.5) * 3
          break
        case 'shy':                              // bashful fidget
          lwx = Math.sin(T * 0.12) * 3; rwx = Math.sin(T * 0.12) * 3
          break
        case 'surprised':
          lwy = rwy = Math.sin(T * 0.5) * 2
          break
        case 'thinking':                         // tap-tap on the chin
          rwr = Math.abs(Math.sin(T * 0.16)) * 6
          break
      }
      lPaw.current?.setAttribute(
        'transform',
        `translate(${(state.armLX + lwx).toFixed(1)} ${(state.armLY + lwy).toFixed(1)}) rotate(${(state.armLR + lwr).toFixed(1)} ${CX - 114} ${CY + 18})`
      )
      rPaw.current?.setAttribute(
        'transform',
        `translate(${(state.armRX + rwx).toFixed(1)} ${(state.armRY + rwy).toFixed(1)}) rotate(${(state.armRR + rwr).toFixed(1)} ${CX + 114} ${CY + 18})`
      )

      const ring = pts.map((p) => ({ x: p.bx + p.nx * p.off, y: p.by + p.ny * p.off }))
      const d = smoothClosed(ring)
      pathRef.current.setAttribute('d', d)
      shadeEl.current.setAttribute('d', d)
      rimEl.current.setAttribute('d', d)
      glowEl.current.setAttribute('d', d)
      bodyClip.current.setAttribute('d', d)
      bodyG.current.setAttribute(
        'transform',
        `translate(${(state.px + ax + state.leanX + mbx).toFixed(2)} ${(state.py + ay + state.leanY + mby).toFixed(2)}) ` +
          `rotate(${lean.toFixed(2)} ${CX} ${CY}) ` +
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
      const curFace = MOODS[state.mood] || MOODS.neutral
      const baseLid = curFace.lid
      const effLid = baseLid + (1 - baseLid) * bl
      const escaleT = curFace.eyes === 'wide' ? 1.15 : 1
      const rx = EYE.rx * escaleT, ry = EYE.ry * escaleT
      const lashOp = Math.min(0.9, Math.max(0, effLid - 0.04) * 3).toFixed(2)
      const coef = curFace.tilt || 0 // inner/outer eyelid slope for this mood
      const lg = lidGeom(CX - EYE.dx, EYE.cy, rx, ry, effLid, -coef)
      const rg = lidGeom(CX + EYE.dx, EYE.cy, rx, ry, effLid, +coef)
      lLid.current?.setAttribute('d', lg.fill)
      rLid.current?.setAttribute('d', rg.fill)
      lLash.current?.setAttribute('d', lg.edge)
      rLash.current?.setAttribute('d', rg.edge)
      lLash.current?.setAttribute('opacity', lashOp)
      rLash.current?.setAttribute('opacity', lashOp)

      // gaze — surprised darts side to side; else explicit gaze, else the pointer
      let gx = 0, gy = 0
      if (state.mood === 'surprised') {
        gx = Math.sin(state.t * 0.05) * 6.5
        gy = -1.5
      } else if (state.mood === 'thinking') {
        if (tphase === 3) { gx = 0; gy = -6 }             // look up at the idea
        else if (tphase >= 4) { gx = 4; gy = -3 }          // aha — glance up, pleased
        else { gx = Math.sin(state.t * 0.03) * 4 - 2; gy = 2.5 } // ponder, look down/around
      } else if (gz) {
        gx = Math.max(-6, Math.min(6, gz.x * 0.1))
        gy = Math.max(-6, Math.min(6, gz.y * 0.1))
      } else if (state.pointer.inside) {
        const dx = state.pointer.x - (CX + state.px)
        const dy = state.pointer.y - (EYE.cy + state.py)
        const m = Math.hypot(dx, dy) || 1
        gx = (dx / m) * Math.min(5, m * 0.05)
        gy = (dy / m) * Math.min(5, m * 0.05)
      }
      gy += curFace.gy || 0 // mood resting gaze (sad/sleepy look down, etc.)
      lEye.current?.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`)
      rEye.current?.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`)

      // --- mouth: rests closed (a small lip line), opens on emotions/actions
      state.mouthOpen *= 0.92
      const mp = MOUTHP[state.mood] || MOUTHP.neutral
      const surprised = state.mood === 'surprised'
      // surprised "wow" — sustained big round O that pulses like talking
      const wow = surprised ? 6 + Math.sin(state.t * 0.16) * 6 : 0
      const openH = Math.max(0, mp.o + wow + state.mouthOpen * 13)
      const w = mp.w + wow * 0.3
      const sd = mp.s * 5
      const cavOp = Math.max(0, Math.min(1, (openH - 2) / 5))

      // lip line — the resting closed mouth; fades out as the mouth opens
      lipRef.current.setAttribute('d', `M${CX - mp.w},${MY} Q${CX},${(MY + sd).toFixed(1)} ${CX + mp.w},${MY}`)
      lipRef.current.setAttribute('opacity', (1 - cavOp).toFixed(2))

      let cav, tcy, trx, tryy
      if (surprised) {
        // a full round O (ellipse)
        const rx = w, ry = Math.max(4, openH * 0.5), cy = MY + 3
        cav = `M${(CX - rx).toFixed(1)},${cy.toFixed(1)} a${rx.toFixed(1)},${ry.toFixed(1)} 0 1 0 ${(2 * rx).toFixed(1)},0 a${rx.toFixed(1)},${ry.toFixed(1)} 0 1 0 ${(-2 * rx).toFixed(1)},0 Z`
        tcy = cy + ry * 0.42; trx = rx * 0.6; tryy = ry * 0.32
      } else {
        const cw = w * 0.82
        cav = `M${(CX - cw).toFixed(1)},${(MY - 0.5).toFixed(1)} Q${CX},${(MY + mp.s * 3).toFixed(1)} ${(CX + cw).toFixed(1)},${(MY - 0.5).toFixed(1)} Q${CX},${(MY + openH).toFixed(1)} ${(CX - cw).toFixed(1)},${(MY - 0.5).toFixed(1)} Z`
        tcy = MY + openH * 0.5; trx = cw * 0.7; tryy = Math.max(1, openH * 0.32)
      }
      mouthRef.current.setAttribute('d', cav)
      mouthRef.current.setAttribute('opacity', cavOp.toFixed(2))
      mouthClip.current.setAttribute('d', cav)
      tongueRef.current.setAttribute('cx', CX)
      tongueRef.current.setAttribute('cy', tcy.toFixed(1))
      tongueRef.current.setAttribute('rx', trx.toFixed(1))
      tongueRef.current.setAttribute('ry', Math.max(1, tryy).toFixed(1))
      tongueRef.current.setAttribute('opacity', cavOp.toFixed(2))

      // tear (sad)
      if (tearRef.current) {
        state.tear += dt
        const range = 46
        const ty = (state.tear * 0.8) % range
        tearRef.current.setAttribute('cy', (EYE.cy + EYE.ry - 2 + ty).toFixed(2))
        tearRef.current.setAttribute('opacity', (1 - ty / range).toFixed(2))
      }

      // --- mood FX particles
      const isLove = state.mood === 'love'
      for (let i = 0; i < 3; i++) {
        const el = heartFx.current[i]; if (!el) continue
        if (isLove) {
          const ph = ((T * 0.016) + i / 3) % 1
          const x = CX + (i - 1) * 22 + Math.sin(ph * 6 + i) * 8
          const y = 132 - ph * 92
          el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.5 + ph).toFixed(2)})`)
          el.setAttribute('opacity', (Math.sin(ph * Math.PI) * 0.95).toFixed(2))
        } else el.setAttribute('opacity', '0')
      }
      const isSleepy = state.mood === 'sleepy'
      for (let i = 0; i < 3; i++) {
        const el = zzzFx.current[i]; if (!el) continue
        if (isSleepy) {
          const ph = ((T * 0.01) + i / 3) % 1
          el.setAttribute('transform', `translate(${(CX + 50 + ph * 22).toFixed(1)} ${(98 - ph * 54).toFixed(1)})`)
          el.setAttribute('opacity', (Math.sin(ph * Math.PI) * 0.9).toFixed(2))
        } else el.setAttribute('opacity', '0')
      }
      const isAngry = state.mood === 'angry'
      for (let i = 0; i < 2; i++) {
        const el = steamFx.current[i]; if (!el) continue
        if (isAngry) {
          const ph = ((T * 0.035) + i * 0.5) % 1
          el.setAttribute('cx', CX + (i ? 66 : -66))
          el.setAttribute('cy', (88 - ph * 44).toFixed(1))
          el.setAttribute('ry', (6 + ph * 6).toFixed(1))
          el.setAttribute('opacity', (Math.sin(ph * Math.PI) * 0.5).toFixed(2))
        } else el.setAttribute('opacity', '0')
      }
      if (sweatFx.current) {
        if (state.mood === 'shy') {
          const ph = (T * 0.02) % 1
          const x = CX + 60, y = 118 + ph * 34
          sweatFx.current.setAttribute('d', `M${x},${y.toFixed(1)} q5,7 0,12 q-5,-5 0,-12 Z`)
          sweatFx.current.setAttribute('opacity', (ph < 0.85 ? 0.8 : ((1 - ph) / 0.15) * 0.8).toFixed(2))
        } else sweatFx.current.setAttribute('opacity', '0')
      }

      // --- thinking overlays: thought cloud (dots / 💡), floating bubble, sparkles
      const cloudOn = thinking && (tphase === 0 || tphase === 2 || tphase === 3)
      state.thoughtA = (state.thoughtA ?? 0) + ((cloudOn ? 1 : 0) - (state.thoughtA ?? 0)) * 0.16
      if (thoughtRef.current) {
        thoughtRef.current.setAttribute('opacity', state.thoughtA.toFixed(2))
        thoughtRef.current.setAttribute('transform', `translate(0 ${(Math.sin(T * 0.05) * 3).toFixed(1)})`)
      }
      if (thoughtTxt.current) {
        const glyph = tphase === 3 ? '💡' : '· · ·'
        if (thoughtTxt.current.textContent !== glyph) thoughtTxt.current.textContent = glyph
      }
      // floating bubble orb (beat 2)
      const orbOn = thinking && tphase === 1
      state.orbA = (state.orbA ?? 0) + ((orbOn ? 1 : 0) - (state.orbA ?? 0)) * 0.16
      if (orbFx.current) {
        const fl = Math.sin(T * 0.06) * 4
        orbFx.current.setAttribute('opacity', state.orbA.toFixed(2))
        orbFx.current.setAttribute('transform', `translate(${fl.toFixed(1)} ${(-Math.abs(fl)).toFixed(1)})`)
      }
      // sparkles (beats 5–6: aha!)
      const sparkOn = thinking && tphase >= 4
      const sPos = [[CX + 78, 60, 9], [CX + 102, 88, 6], [CX + 56, 92, 5]]
      sparkFx.current.forEach((el, i) => {
        if (!el) return
        const tw = 0.5 + 0.5 * Math.sin(T * 0.12 + i * 2.1)
        const [sx0, sy0, ss] = sPos[i]
        el.setAttribute('d', sparkle(sx0, sy0, ss * (0.5 + 0.7 * tw)))
        el.setAttribute('opacity', (sparkOn ? (0.45 + 0.55 * tw) : 0).toFixed(2))
      })

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

  const OpenEye = ({ ex, eyeRef, lidRef, lashRef, clipId }) => (
    <g>
      <clipPath id={clipId}>
        <ellipse cx={ex} cy={EYE.cy} rx={EYE.rx * escale + 3} ry={EYE.ry * escale + 3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g ref={eyeRef}>
          <ellipse cx={ex} cy={EYE.cy} rx={EYE.rx * escale} ry={EYE.ry * escale} fill={`url(#${eid})`} />
          {/* glossy highlights — lit from the upper-left, matched on both eyes */}
          <ellipse cx={ex - 6} cy={EYE.cy - 11} rx="8.5" ry="11" fill="#fff" />
          <circle cx={ex + 7} cy={EYE.cy + 10} r="4.6" fill="#fff" />
          <circle cx={ex + 9} cy={EYE.cy - 5} r="2" fill="#fff" opacity="0.85" />
        </g>
        {/* skin lid flap (body-shaded so it looks like skin folding over) */}
        <path ref={lidRef} d="" fill={`url(#${gid})`} />
        {/* lash line along the lid's leading edge */}
        <path ref={lashRef} d="" fill="none" stroke="#2b1533" strokeWidth="3" strokeLinecap="round" opacity="0" />
      </g>
    </g>
  )
  const renderEye = (ex, eyeRef, lidRef, lashRef, clipId) => {
    if (face.eyes === 'happy')
      return <path d={`M${ex - 16},${EYE.cy + 3} Q${ex},${EYE.cy - 15} ${ex + 16},${EYE.cy + 3}`} fill="none" stroke="#23142e" strokeWidth="5" strokeLinecap="round" />
    if (face.eyes === 'closed')
      return <path d={`M${ex - 15},${EYE.cy - 1} Q${ex},${EYE.cy + 9} ${ex + 15},${EYE.cy - 1}`} fill="none" stroke="#23142e" strokeWidth="4.5" strokeLinecap="round" />
    if (face.eyes === 'love') return <path d={heart(ex, EYE.cy, 30)} fill="#ff3d77" />
    return <OpenEye ex={ex} eyeRef={eyeRef} lidRef={lidRef} lashRef={lashRef} clipId={clipId} />
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
        <radialGradient id={eid} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor={`hsl(${hue}, 50%, 10%)`} />
          <stop offset="65%" stopColor={`hsl(${hue}, 48%, 13%)`} />
          <stop offset="100%" stopColor={`hsl(${hue}, 44%, 22%)`} />
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

      {/* ground shadow (stays put) — sits under the feet */}
      <ellipse cx={CX} cy={CY + HY + 26} rx="88" ry="14" fill="rgba(0,0,0,0.22)" />

      <g ref={bodyG}>
        {/* outer glow (moves with body) */}
        <path ref={glowEl} d="" fill={`hsla(${hue}, 100%, 70%, 0.35)`} filter={`url(#${fid})`} />

        {/* cute stubby legs — drawn behind the body so their tops tuck underneath.
            Each shape reuses the body radial gradient, which shades light-top →
            dark-bottom per shape for an automatic rounded 3D look. */}
        <g>
          {/* contact shadows under the feet */}
          <ellipse cx={CX - 40} cy={301} rx="20" ry="6" fill="rgba(0,0,0,0.18)" />
          <ellipse cx={CX + 40} cy={301} rx="20" ry="6" fill="rgba(0,0,0,0.18)" />
          {/* left leg + foot */}
          <g>
            <ellipse cx={CX - 39} cy={276} rx="16" ry="23" fill={`url(#${gid})`} />
            <ellipse cx={CX - 42} cy={292} rx="21" ry="14" fill={`url(#${gid})`} />
            <ellipse cx={CX - 44} cy={289} rx="9" ry="5" fill="#fff" opacity="0.3" />
            <ellipse cx={CX - 44} cy={270} rx="5.5" ry="8" fill="#fff" opacity="0.3" />
          </g>
          {/* right leg + foot */}
          <g>
            <ellipse cx={CX + 39} cy={276} rx="16" ry="23" fill={`url(#${gid})`} />
            <ellipse cx={CX + 42} cy={292} rx="21" ry="14" fill={`url(#${gid})`} />
            <ellipse cx={CX + 40} cy={289} rx="9" ry="5" fill="#fff" opacity="0.3" />
            <ellipse cx={CX + 34} cy={270} rx="5.5" ry="8" fill="#fff" opacity="0.3" />
          </g>
        </g>

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
        {renderEye(lex, lEye, lLid, lLash, `lc-${hue}`)}
        {renderEye(rex, rEye, rLid, rLash, `rc-${hue}`)}
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

        {/* little arms — rest at the sides, rise to cover the eyes for 'password' */}
        <g ref={lPaw}>
          <ellipse cx={CX - 114} cy={CY + 18} rx="16" ry="18" fill={`url(#${gid})`} stroke={`hsla(${hue}, 70%, 40%, 0.5)`} strokeWidth="1" />
          <ellipse cx={CX - 116} cy={CY + 12} rx="8" ry="6" fill="#fff" opacity="0.22" />
        </g>
        <g ref={rPaw}>
          <ellipse cx={CX + 114} cy={CY + 18} rx="16" ry="18" fill={`url(#${gid})`} stroke={`hsla(${hue}, 70%, 40%, 0.5)`} strokeWidth="1" />
          <ellipse cx={CX + 116} cy={CY + 12} rx="8" ry="6" fill="#fff" opacity="0.22" />
        </g>

        {/* mood FX — counter-rotated so authored colours survive the mood hue-shift */}
        <g style={{ filter: `hue-rotate(${-deg}deg)` }}>
          {[0, 1, 2].map((i) => (
            <path key={`h${i}`} ref={(el) => (heartFx.current[i] = el)} d={heart(0, 0, 8)} fill="#ff4d7d" opacity="0" />
          ))}
          {[0, 1, 2].map((i) => (
            <text key={`z${i}`} ref={(el) => (zzzFx.current[i] = el)} fontSize={12 + i * 5} fontWeight="800" fontFamily="system-ui, sans-serif" fill="#bcd2ff" opacity="0">Z</text>
          ))}
          {[0, 1].map((i) => (
            <ellipse key={`s${i}`} ref={(el) => (steamFx.current[i] = el)} rx="6" ry="8" fill="#ff8a6b" opacity="0" />
          ))}
          <path ref={sweatFx} d="" fill="#9fd4ff" opacity="0" />
        </g>
      </g>

      {/* thought bubble — floats by the head while 'thinking' */}
      <g ref={thoughtRef} opacity="0">
        <circle cx={CX + 52} cy={148} r="4" fill="#fff" opacity="0.8" />
        <circle cx={CX + 62} cy={126} r="6" fill="#fff" opacity="0.9" />
        <g>
          <circle cx={CX + 62} cy={92} r="21" fill="#fff" />
          <circle cx={CX + 88} cy={98} r="15" fill="#fff" />
          <circle cx={CX + 86} cy={78} r="14" fill="#fff" />
          <circle cx={CX + 44} cy={86} r="15" fill="#fff" />
          <circle cx={CX + 70} cy={74} r="13" fill="#fff" />
        </g>
        <text
          ref={thoughtTxt}
          x={CX + 66}
          y={92}
          fontSize="20"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
          fill="#7a5cff"
        >
          · · ·
        </text>
      </g>

      {/* floating soap-bubble (thinking beat 2) */}
      <g ref={orbFx} opacity="0">
        <circle cx={CX + 96} cy={78} r="15" fill={`hsla(${hue}, 90%, 82%, 0.4)`} stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
        <circle cx={CX + 90} cy={72} r="4.5" fill="#fff" opacity="0.75" />
      </g>

      {/* sparkles (thinking "aha") */}
      <g fill="#fdf6ff">
        {[0, 1, 2].map((i) => (
          <path key={`sp${i}`} ref={(el) => (sparkFx.current[i] = el)} d="" opacity="0" />
        ))}
      </g>
    </svg>
  )
}
