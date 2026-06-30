import { useEffect, useRef } from 'react'

/**
 * Jellyfish — an original "live action" sticker with realistic motion.
 *
 *  • The bell is generated procedurally and PULSES — a quick contraction
 *    (narrow + tall) then a slow relaxation (wide + flat), the real medusa
 *    swim stroke. Each contraction thrusts the body upward; it then sinks.
 *  • Tentacles (frilly oral arms + thin marginal tentacles) are verlet rope
 *    chains pinned to the bell margin. When the bell darts up they trail and
 *    bunch; on the glide they stream back down. Dragging flings them too.
 *  • Translucent layered bell, gonad rings, radial canals and a soft
 *    bioluminescent glow. All hand-rolled on requestAnimationFrame.
 */

const VB_W = 300
const VB_H = 470
const CX = 150
const APEX = 100
const W0 = 112
const H0 = 80
const BOW0 = 24

const ORAL = 5
const MARG = 14

const G = 0.34          // tentacle gravity
const FR = 0.88         // verlet friction
const ITER = 4          // constraint iterations

const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)

function getBell(c) {
  const W = W0 * (1 - 0.22 * c)
  const H = H0 * (1 + 0.16 * c)
  const rimY = APEX + H
  const bow = BOW0 * (1 - 0.45 * c)
  return { W, H, rimY, bow }
}

// anchor point on the bottom margin, f: 0 = left … 1 = right (center lowest)
function anchorLocal(f, c) {
  const { W, rimY, bow } = getBell(c)
  return { x: CX - W + 2 * W * f, y: rimY + bow * Math.sin(Math.PI * f) }
}

// closed smooth outline (Catmull-Rom -> bezier)
function smoothClosed(pts) {
  const n = pts.length
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d + 'Z'
}

// open smooth path for a tentacle centreline
function smoothOpen(pts) {
  const n = pts.length
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || pts[i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

function bellPath(c, t) {
  const { W, H, rimY, bow } = getBell(c)
  const pts = []
  const M = 22
  for (let i = 0; i <= M; i++) {
    const a = Math.PI + (i / M) * Math.PI
    pts.push({ x: CX + Math.cos(a) * W, y: rimY + Math.sin(a) * H })
  }
  const Mb = 20
  for (let i = 1; i < Mb; i++) {
    const f = i / Mb
    const x = CX + W - 2 * W * f
    const frill = Math.sin(f * Math.PI * 10 + t * 0.05) * 3 * (1 - c * 0.5)
    pts.push({ x, y: rimY + bow * Math.sin(Math.PI * f) + frill })
  }
  return smoothClosed(pts)
}

export default function Jellyfish({ size = 300, hue = 200, className = '' }) {
  const svgRef = useRef(null)
  const glowG = useRef(null)
  const glowEl = useRef(null)
  const bellG = useRef(null)
  const bellEl = useRef(null)
  const innerG = useRef(null)
  const oralEls = useRef([])
  const margEls = useRef([])

  const ref = useRef(null)
  if (!ref.current) {
    const makeChain = (f, len, nodes, baseW, sway) => {
      const a = anchorLocal(f, 0)
      const segLen = len / (nodes - 1)
      const ns = []
      for (let i = 0; i < nodes; i++) {
        ns.push({ x: a.x, y: a.y + i * segLen, px: a.x, py: a.y + i * segLen })
      }
      return { f, segLen, nodes: ns, baseW, sway, phase: Math.random() * 6.28 }
    }
    const oral = []
    for (let i = 0; i < ORAL; i++) {
      const f = lerp(0.34, 0.66, ORAL === 1 ? 0.5 : i / (ORAL - 1))
      oral.push(makeChain(f, 200 + Math.random() * 30, 12, 9, 0.18))
    }
    const marg = []
    for (let i = 0; i < MARG; i++) {
      const f = lerp(0.05, 0.95, i / (MARG - 1))
      marg.push(makeChain(f, 150 + Math.random() * 60, 9, 1.6, 0.32))
    }
    ref.current = {
      oral, marg,
      px: 0, py: 0, vx: 0, vy: 0,
      tx: 0, ty: 0, dragging: false, grabDX: 0, grabDY: 0,
      pointer: { x: CX, y: APEX, inside: false },
      phase: Math.random() * 2600, // pulse clock (ms)
      cyc: 2600,
      prevC: 0,
      t: 0,
    }
  }
  const state = ref.current

  useEffect(() => {
    let raf
    let last = performance.now()

    const toVB = (cx, cy) => {
      const r = svgRef.current.getBoundingClientRect()
      return {
        x: ((cx - r.left) / r.width) * VB_W,
        y: ((cy - r.top) / r.height) * VB_H,
      }
    }

    const onDown = (e) => {
      const { x, y } = toVB(e.clientX, e.clientY)
      state.dragging = true
      state.grabDX = state.px - x
      state.grabDY = state.py - y
      // a poke makes it pulse hard (dart away)
      state.phase = 0
      state.cyc = 2000
      svgRef.current.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      const { x, y } = toVB(e.clientX, e.clientY)
      state.pointer = { x, y, inside: true }
      if (state.dragging) {
        state.tx = x + state.grabDX
        state.ty = y + state.grabDY
      }
    }
    const onUp = () => { state.dragging = false; state.tx = 0; state.ty = 0 }
    const onLeave = () => { state.pointer.inside = false }

    const svg = svgRef.current
    svg.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    svg.addEventListener('pointerleave', onLeave)

    const simChain = (chain, c, dt) => {
      const a = anchorLocal(chain.f, c)
      const ax = a.x + state.px
      const ay = a.y + state.py
      const ns = chain.nodes
      ns[0].x = ax; ns[0].y = ay; ns[0].px = ax; ns[0].py = ay
      for (let i = 1; i < ns.length; i++) {
        const nd = ns[i]
        const vx = (nd.x - nd.px) * FR
        const vy = (nd.y - nd.py) * FR
        nd.px = nd.x; nd.py = nd.y
        nd.x += vx + Math.sin(state.t * 0.03 + chain.phase + i * 0.4) * chain.sway * dt
        nd.y += vy + G * dt
      }
      for (let k = 0; k < ITER; k++) {
        for (let i = 0; i < ns.length - 1; i++) {
          const p = ns[i], q = ns[i + 1]
          const dx = q.x - p.x, dy = q.y - p.y
          const dist = Math.hypot(dx, dy) || 0.0001
          const diff = (chain.segLen - dist) / dist
          if (i === 0) { q.x += dx * diff; q.y += dy * diff }
          else {
            const ox = dx * diff * 0.5, oy = dy * diff * 0.5
            p.x -= ox; p.y -= oy; q.x += ox; q.y += oy
          }
        }
      }
    }

    const ribbon = (chain) => {
      const ns = chain.nodes
      const n = ns.length
      const L = [], R = []
      for (let i = 0; i < n; i++) {
        const prev = ns[Math.max(0, i - 1)]
        const next = ns[Math.min(n - 1, i + 1)]
        const dx = next.x - prev.x, dy = next.y - prev.y
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len, ny = dx / len
        const taper = 1 - i / (n - 1)
        const w = chain.baseW * taper * (0.7 + 0.3 * Math.sin(state.t * 0.06 + i * 0.6 + chain.phase))
        L.push({ x: ns[i].x + nx * w, y: ns[i].y + ny * w })
        R.push({ x: ns[i].x - nx * w, y: ns[i].y - ny * w })
      }
      let d = `M${L[0].x.toFixed(2)},${L[0].y.toFixed(2)}`
      for (let i = 1; i < n; i++) d += `L${L[i].x.toFixed(2)},${L[i].y.toFixed(2)}`
      for (let i = n - 1; i >= 0; i--) d += `L${R[i].x.toFixed(2)},${R[i].y.toFixed(2)}`
      return d + 'Z'
    }

    const tick = (now) => {
      const dtMs = now - last
      const dt = Math.min(2, dtMs / 16.67)
      last = now
      state.t += dt

      // --- pulse cycle: quick contract, slow relax
      state.phase += dtMs
      if (state.phase > state.cyc) { state.phase -= state.cyc; state.cyc = 2400 + Math.random() * 700 }
      const ph = state.phase / state.cyc
      let c
      if (ph < 0.32) c = smooth(ph / 0.32)
      else c = 1 - smooth((ph - 0.32) / 0.68)
      const dc = c - state.prevC
      state.prevC = c

      // --- body drift: thrust up on contraction, sink slowly, drift, stay home
      if (dc > 0) state.vy -= dc * 34            // jet propulsion
      state.vy += 0.05                            // sink
      state.vx += Math.sin(state.t * 0.012) * 0.05 // lateral drift
      if (state.dragging) {
        state.vx += (state.tx - state.px) * 0.10
        state.vy += (state.ty - state.py) * 0.10
      } else {
        state.vx += (0 - state.px) * 0.004        // ease home
        state.vy += (0 - state.py) * 0.004
      }
      state.vx *= 0.90; state.vy *= 0.90
      state.px += state.vx * dt; state.py += state.vy * dt

      // --- bell
      const d = bellPath(c, state.t)
      bellEl.current.setAttribute('d', d)
      glowEl.current.setAttribute('d', d)
      const tf = `translate(${state.px.toFixed(2)} ${state.py.toFixed(2)})`
      bellG.current.setAttribute('transform', tf)
      glowG.current.setAttribute('transform', tf)
      const { W, H } = getBell(c)
      innerG.current.setAttribute(
        'transform',
        `translate(${CX} ${APEX}) scale(${(W / W0).toFixed(3)} ${(H / H0).toFixed(3)}) translate(${-CX} ${-APEX})`
      )

      // --- tentacles (absolute coords so they trail when dragged)
      for (let i = 0; i < state.oral.length; i++) {
        simChain(state.oral[i], c, dt)
        oralEls.current[i]?.setAttribute('d', ribbon(state.oral[i]))
      }
      for (let i = 0; i < state.marg.length; i++) {
        simChain(state.marg[i], c, dt)
        margEls.current[i]?.setAttribute('d', smoothOpen(state.marg[i].nodes))
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

  const gid = `bell-${hue}`
  const fid = `glow-${hue}`
  const rim = `hsla(${hue}, 95%, 82%, 0.85)`
  const oralCol = `hsla(${hue}, 85%, 74%, 0.42)`
  const margCol = `hsla(${hue}, 95%, 85%, 0.55)`
  const canalCol = `hsla(${hue}, 90%, 80%, 0.5)`
  const gonadCol = `hsla(${(hue + 20) % 360}, 90%, 80%, 0.55)`

  // static gonad ring + canal positions, in local bell space
  const { rimY } = getBell(0)
  const gonadY = APEX + H0 * 0.7
  const canals = [0.18, 0.39, 0.61, 0.82].map((f) => {
    const a = anchorLocal(f, 0)
    return `M${CX},${APEX + 18} Q${(CX + a.x) / 2},${(APEX + rimY) / 2} ${a.x},${a.y - 4}`
  })

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={(size * VB_H) / VB_W}
      style={{ touchAction: 'none', cursor: 'grab', overflow: 'visible', userSelect: 'none' }}
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="28%" r="75%">
          <stop offset="0%" stopColor={`hsla(${hue}, 100%, 92%, 0.6)`} />
          <stop offset="45%" stopColor={`hsla(${hue}, 85%, 74%, 0.42)`} />
          <stop offset="100%" stopColor={`hsla(${hue}, 80%, 58%, 0.15)`} />
        </radialGradient>
        <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* soft bioluminescent halo */}
      <g ref={glowG}>
        <path ref={glowEl} d="" fill={`hsla(${hue}, 100%, 75%, 0.28)`} filter={`url(#${fid})`} />
      </g>

      {/* tentacles behind the bell (absolute coords) */}
      {state.marg.map((_, i) => (
        <path
          key={`m${i}`}
          ref={(el) => (margEls.current[i] = el)}
          d=""
          fill="none"
          stroke={margCol}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
      {state.oral.map((_, i) => (
        <path key={`o${i}`} ref={(el) => (oralEls.current[i] = el)} d="" fill={oralCol} />
      ))}

      {/* the bell */}
      <g ref={bellG}>
        <path ref={bellEl} d="" fill={`url(#${gid})`} stroke={rim} strokeWidth="2.5" />
        <g ref={innerG}>
          {canals.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={canalCol} strokeWidth="1.4" />
          ))}
          <ellipse cx={CX - 26} cy={gonadY} rx="12" ry="16" fill={gonadCol} />
          <ellipse cx={CX + 26} cy={gonadY} rx="12" ry="16" fill={gonadCol} />
          <ellipse cx={CX} cy={gonadY - 6} rx="13" ry="17" fill={gonadCol} opacity="0.8" />
          <ellipse cx={CX} cy={APEX + 26} rx="46" ry="30" fill={`hsla(${hue}, 100%, 95%, 0.35)`} />
        </g>
      </g>
    </svg>
  )
}
