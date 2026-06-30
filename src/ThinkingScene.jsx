import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, Float } from '@react-three/drei'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

/**
 * ThinkingScene — the cute purple ghost-blob, in real 3D.
 *
 * Not a sphere: the body is a deformed gumdrop (narrow rounded top, wide
 * bottom) with little foot nubs and arm nubs, an open smiling mouth, brows,
 * big sparkly eyes, blush and two floating bubbles. Soft clay-jelly material
 * (low reflections) lit for a friendly render. Idles with a bob + squish.
 */

const BODY = '#a259ff'

const bodyMat = {
  color: BODY,
  roughness: 0.33,
  metalness: 0,
  clearcoat: 0.55,
  clearcoatRoughness: 0.38,
  transmission: 0,
  emissive: '#6d28d9',
  emissiveIntensity: 0.18,
  sheen: 0.7,
  sheenRoughness: 0.4,
  sheenColor: '#d8b4fe',
  envMapIntensity: 0.45,
}

// a sphere deformed into a gumdrop: narrower top, wider bottom
function useGumdrop() {
  return useMemo(() => {
    const g = new THREE.SphereGeometry(1, 160, 160)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const ny = v.y // -1 (bottom) .. 1 (top)
      const w = 1 + 0.24 * -ny - 0.05 * Math.max(0, ny) // bottom wider, top tucked
      v.x *= w
      v.z *= w
      v.y *= 1.08
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
}

function Eye({ x }) {
  return (
    <group position={[x, 0.06, 0.86]}>
      <mesh>
        <sphereGeometry args={[0.2, 40, 40]} />
        <meshStandardMaterial color="#190d22" roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[-0.07, 0.08, 0.13]}>
        <sphereGeometry args={[0.08, 20, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.06, -0.05, 0.14]}>
        <sphereGeometry args={[0.038, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Brow({ x, flip }) {
  return (
    <mesh position={[x, 0.34, 0.82]} rotation={[0.25, 0, flip * 0.18]}>
      <boxGeometry args={[0.17, 0.04, 0.05]} />
      <meshStandardMaterial color="#2a1330" roughness={0.5} />
    </mesh>
  )
}

function Slime() {
  const group = useRef()
  const geo = useGumdrop()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.position.y = 0.05 + Math.sin(t * 1.1) * 0.05
    group.current.rotation.y = Math.sin(t * 0.5) * 0.08
    group.current.rotation.z = Math.sin(t * 0.7) * 0.025
    const s = Math.sin(t * 1.7) * 0.025
    group.current.scale.set(1 + s, 1 - s, 1 + s)
  })

  return (
    <group ref={group}>
      {/* body */}
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>

      {/* arm nubs */}
      <mesh position={[-0.92, -0.35, 0.12]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0.92, -0.35, 0.12]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>

      {/* foot nubs */}
      <mesh position={[-0.3, -1.02, 0.32]} scale={[1, 0.8, 1.05]} castShadow>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0.3, -1.02, 0.32]} scale={[1, 0.8, 1.05]} castShadow>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>

      {/* soft painted top shine */}
      <mesh position={[-0.3, 0.74, 0.55]} rotation={[0.5, -0.4, 0.5]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </mesh>

      <Eye x={-0.27} />
      <Eye x={0.27} />
      <Brow x={-0.27} flip={1} />
      <Brow x={0.27} flip={-1} />

      {/* blush */}
      <mesh position={[-0.54, -0.12, 0.72]} scale={[1, 0.7, 0.4]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#ff8fb6" transparent opacity={0.6} roughness={0.6} />
      </mesh>
      <mesh position={[0.54, -0.12, 0.72]} scale={[1, 0.7, 0.4]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#ff8fb6" transparent opacity={0.6} roughness={0.6} />
      </mesh>

      {/* open smiling mouth: dark cavity + tongue, with an upper smile rim */}
      <mesh position={[0, -0.24, 0.9]} scale={[0.2, 0.14, 0.12]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial color="#3a0f28" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.3, 0.97]} scale={[0.12, 0.06, 0.06]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial color="#ff6f96" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.17, 0.92]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.16, 0.022, 12, 28, Math.PI]} />
        <meshStandardMaterial color="#3a0f28" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Bubble({ pos, r, speed }) {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    ref.current.position.y = pos[1] + Math.sin(t * speed) * 0.08
    ref.current.scale.setScalar(1 + Math.sin(t * speed) * 0.05)
  })
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[r, 32, 32]} />
      <meshPhysicalMaterial {...bodyMat} clearcoat={0.6} />
    </mesh>
  )
}

export default function ThinkingScene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 4.6], fov: 34 }}>
      <color attach="background" args={['#0c0a16']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[-3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[4, 1, 3]} intensity={0.8} color="#f0abfc" />
      <pointLight position={[-4, 0, -3]} intensity={1.2} color="#a855f7" />

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <Slime />
        <Bubble pos={[1.2, 1.25, 0.2]} r={0.16} speed={1.4} />
        <Bubble pos={[-1.15, -0.55, 0.3]} r={0.1} speed={1.7} />
      </Float>

      <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={6} blur={2.6} far={3} color="#160826" />
      <Environment preset="apartment" environmentIntensity={0.5} />
    </Canvas>
  )
}
