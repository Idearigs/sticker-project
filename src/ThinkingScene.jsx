import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Float } from '@react-three/drei'
import { useRef } from 'react'

/**
 * ThinkingScene — the exact cute purple blob, in real 3D.
 *
 * React Three Fiber + drei. The body is a translucent, clear-coated
 * MeshPhysicalMaterial (jelly that light passes through) lit by an environment
 * map for real glossy reflections. Big sparkly eyes, a soft smile, blush
 * cheeks, a painted top shine, and a little floating bubble — matching the
 * reference. It idles with a gentle bob + jelly squish.
 */

const BODY = '#9b4dff'
const BODY_EMISSIVE = '#6d28d9'

function bodyMaterialProps() {
  return {
    color: BODY,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    transmission: 0.18,
    thickness: 1.6,
    ior: 1.4,
    emissive: BODY_EMISSIVE,
    emissiveIntensity: 0.28,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: '#d8b4fe',
    envMapIntensity: 1.3,
    attenuationColor: '#b266ff',
    attenuationDistance: 2.4,
  }
}

function Eye({ x }) {
  return (
    <group position={[x, 0.04, 0.9]}>
      {/* big round black eye */}
      <mesh>
        <sphereGeometry args={[0.2, 40, 40]} />
        <meshStandardMaterial color="#1a0f24" roughness={0.18} metalness={0.15} />
      </mesh>
      {/* big upper-left sparkle */}
      <mesh position={[-0.07, 0.08, 0.13]}>
        <sphereGeometry args={[0.082, 20, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* small lower sparkle */}
      <mesh position={[0.06, -0.05, 0.14]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Slime() {
  const group = useRef()
  const body = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.position.y = -0.1 + Math.sin(t * 1.1) * 0.05
    group.current.rotation.y = Math.sin(t * 0.5) * 0.08
    group.current.rotation.z = Math.sin(t * 0.7) * 0.03
    const s = Math.sin(t * 1.7) * 0.03
    body.current.scale.set(1 + s, 1.06 - s, 1 + s) // gumdrop + jelly breathe
  })

  return (
    <group ref={group}>
      {/* body — slightly taller-than-wide gumdrop */}
      <mesh ref={body} scale={[1, 1.06, 1]} castShadow>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhysicalMaterial {...bodyMaterialProps()} />
      </mesh>

      {/* painted glossy top shine */}
      <mesh position={[-0.32, 0.66, 0.6]} rotation={[0.5, -0.4, 0.5]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
      <mesh position={[-0.12, 0.78, 0.45]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>

      <Eye x={-0.26} />
      <Eye x={0.26} />

      {/* blush cheeks */}
      <mesh position={[-0.52, -0.18, 0.72]} scale={[1, 0.7, 0.4]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#ff8fb6" transparent opacity={0.6} roughness={0.6} />
      </mesh>
      <mesh position={[0.52, -0.18, 0.72]} scale={[1, 0.7, 0.4]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#ff8fb6" transparent opacity={0.6} roughness={0.6} />
      </mesh>

      {/* soft smile (half-torus arc) */}
      <mesh position={[0, -0.26, 0.93]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.12, 0.026, 14, 28, Math.PI]} />
        <meshStandardMaterial color="#3f1030" roughness={0.5} />
      </mesh>
    </group>
  )
}

function FloatingBubble() {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    ref.current.position.y = 1.35 + Math.sin(t * 1.4) * 0.08
    ref.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.05)
  })
  return (
    <mesh ref={ref} position={[1.25, 1.35, 0.2]}>
      <sphereGeometry args={[0.16, 32, 32]} />
      <meshPhysicalMaterial {...bodyMaterialProps()} transmission={0.4} />
    </mesh>
  )
}

export default function ThinkingScene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 4.4], fov: 34 }}>
      <color attach="background" args={['#0c0a16']} />
      <ambientLight intensity={0.5} />
      {/* key light upper-left → puts the glossy shine top-left like the art */}
      <directionalLight position={[-3, 5, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[4, 1, 3]} intensity={1.1} color="#f0abfc" />
      <pointLight position={[-4, 0, -3]} intensity={1.8} color="#a855f7" />

      <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.4}>
        <Slime />
        <FloatingBubble />
      </Float>

      <ContactShadows position={[0, -1.2, 0]} opacity={0.5} scale={6} blur={2.6} far={3} color="#160826" />
      <Environment preset="city" />
    </Canvas>
  )
}
