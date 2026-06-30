import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Float } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

/**
 * ThinkingScene — a hyper-real 3D version of the slime, deep in thought.
 *
 * Built with React Three Fiber + drei. The body is a translucent, clear-coated
 * MeshPhysicalMaterial lit by an environment map for real reflections; it bobs
 * and squishes, rests a hand on its chin, and floats a thought bubble that
 * cycles dots -> 💡 idea -> ✨ sparkles on a loop.
 */

const PURPLE = '#7c3aed'

function Eye({ x }) {
  return (
    <group position={[x, 0.16, 0.86]}>
      <mesh>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color="#1c1024" roughness={0.25} metalness={0.1} />
      </mesh>
      {/* squeezed-up "thinking" look via a soft upper highlight */}
      <mesh position={[-0.05, 0.06, 0.12]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.04, -0.02, 0.13]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Brow({ x, flip = 1 }) {
  return (
    <mesh position={[x, 0.42, 0.84]} rotation={[0.2, 0, flip * -0.25]}>
      <boxGeometry args={[0.22, 0.045, 0.05]} />
      <meshStandardMaterial color="#2a1430" roughness={0.5} />
    </mesh>
  )
}

function Cheek({ x }) {
  return (
    <mesh position={[x, -0.02, 0.74]} scale={[1, 0.7, 0.4]}>
      <sphereGeometry args={[0.17, 24, 24]} />
      <meshStandardMaterial color="#ff8fb0" transparent opacity={0.55} roughness={0.6} />
    </mesh>
  )
}

function Slime() {
  const group = useRef()
  const body = useRef()
  const hand = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // pondering head motion — slow tilt + look up
    group.current.rotation.z = Math.sin(t * 0.6) * 0.06
    group.current.rotation.y = Math.sin(t * 0.4) * 0.10
    group.current.rotation.x = -0.04 + Math.sin(t * 0.5) * 0.03
    // jelly breathing squash
    const s = Math.sin(t * 1.6) * 0.035
    body.current.scale.set(1 + s, 1 - s, 1 + s)
    // finger tapping the chin
    hand.current.position.y = -0.5 + Math.sin(t * 4) * 0.025
  })

  return (
    <group ref={group} position={[0, -0.1, 0]}>
      {/* body */}
      <mesh ref={body} castShadow>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhysicalMaterial
          color={PURPLE}
          roughness={0.18}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.18}
          transmission={0.18}
          thickness={1.6}
          ior={1.4}
          emissive={'#5b21b6'}
          emissiveIntensity={0.22}
          sheen={1}
          sheenRoughness={0.4}
          sheenColor={'#ddd6fe'}
          envMapIntensity={1.25}
          attenuationColor={'#a855f7'}
          attenuationDistance={2.5}
        />
      </mesh>

      <Eye x={-0.34} />
      <Eye x={0.34} />
      <Brow x={-0.34} flip={1} />
      <Brow x={0.34} flip={-1} />
      <Cheek x={-0.5} />
      <Cheek x={0.5} />

      {/* smiling mouth (half torus) */}
      <mesh position={[0, -0.16, 0.92]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.1, 0.028, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#5a1130" roughness={0.5} />
      </mesh>

      {/* hand resting on chin */}
      <mesh ref={hand} position={[0.32, -0.5, 0.82]} castShadow>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshPhysicalMaterial color={PURPLE} roughness={0.2} clearcoat={1} clearcoatRoughness={0.2} sheen={1} sheenColor={'#ddd6fe'} envMapIntensity={1.2} />
      </mesh>

      {/* little feet */}
      <mesh position={[-0.34, -0.95, 0.3]} scale={[1, 0.7, 1.1]} castShadow>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshPhysicalMaterial color={PURPLE} roughness={0.2} clearcoat={1} sheen={1} sheenColor={'#ddd6fe'} />
      </mesh>
      <mesh position={[0.34, -0.95, 0.3]} scale={[1, 0.7, 1.1]} castShadow>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshPhysicalMaterial color={PURPLE} roughness={0.2} clearcoat={1} sheen={1} sheenColor={'#ddd6fe'} />
      </mesh>
    </group>
  )
}

function ThoughtBubble() {
  const dots = useRef()
  const bulb = useRef()
  const bulbGlow = useRef()
  const sparks = useRef()
  const dotMeshes = useRef([])
  const sparkMeshes = useRef([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const phase = (t % 6) / 6 // 0..1 over 6s
    const showDots = phase < 0.4
    const showBulb = phase >= 0.4 && phase < 0.72
    const showSpark = phase >= 0.72

    dots.current.visible = showDots
    bulb.current.visible = showBulb
    sparks.current.visible = showSpark

    // dots bob in sequence
    if (showDots) {
      dotMeshes.current.forEach((m, i) => {
        if (m) m.position.y = Math.sin(t * 6 - i * 0.7) * 0.04
      })
    }
    // bulb pops in + glows
    if (showBulb) {
      const p = (phase - 0.4) / 0.32
      const pop = Math.min(1, p * 3)
      bulb.current.scale.setScalar(pop * (1 + Math.sin(t * 8) * 0.04))
      bulbGlow.current.material.opacity = 0.4 + Math.sin(t * 8) * 0.2
    }
    // sparkles twinkle + spin
    if (showSpark) {
      sparkMeshes.current.forEach((m, i) => {
        if (!m) return
        m.rotation.z = t * 2 + i
        const tw = 0.6 + Math.abs(Math.sin(t * 5 + i * 1.3)) * 0.6
        m.scale.setScalar(tw)
      })
    }
  })

  const bubbleMat = (
    <meshPhysicalMaterial color="#ffffff" roughness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.85} clearcoat={1} envMapIntensity={1} />
  )

  return (
    <group position={[1.5, 1.5, 0.2]}>
      {/* trail */}
      <mesh position={[-0.85, -0.8, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        {bubbleMat}
      </mesh>
      <mesh position={[-0.55, -0.5, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        {bubbleMat}
      </mesh>
      {/* main bubble */}
      <mesh scale={[1.15, 1, 1]}>
        <sphereGeometry args={[0.5, 48, 48]} />
        {bubbleMat}
      </mesh>

      {/* dots */}
      <group ref={dots}>
        {[-0.18, 0, 0.18].map((x, i) => (
          <mesh key={i} ref={(m) => (dotMeshes.current[i] = m)} position={[x, 0, 0.42]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial color={PURPLE} emissive={PURPLE} emissiveIntensity={0.4} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* lightbulb idea */}
      <group ref={bulb} position={[0, 0.02, 0.42]}>
        <mesh ref={bulbGlow}>
          <sphereGeometry args={[0.24, 24, 24]} />
          <meshBasicMaterial color="#fff3b0" transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#ffe27a" emissive="#ffcf3a" emissiveIntensity={1.4} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#9a8a55" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* sparkles */}
      <group ref={sparks} position={[0, 0, 0.42]}>
        {[[-0.18, 0.12], [0.2, 0.05], [0.02, -0.2], [0.16, -0.16]].map((p, i) => (
          <mesh key={i} ref={(m) => (sparkMeshes.current[i] = m)} position={[p[0], p[1], 0]}>
            <octahedronGeometry args={[0.08, 0]} />
            <meshStandardMaterial color="#fff4b0" emissive="#ffd84a" emissiveIntensity={1.6} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function ThinkingScene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.2, 5], fov: 34 }}>
      <color attach="background" args={['#0c0a16']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 1, -3]} intensity={2} color="#a855f7" />
      <pointLight position={[3, -2, 2]} intensity={0.7} color="#f0abfc" />

      <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.5}>
        <Slime />
        <ThoughtBubble />
      </Float>

      <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={6} blur={2.6} far={3} color="#1a0a2a" />
      <Environment preset="city" />
    </Canvas>
  )
}
