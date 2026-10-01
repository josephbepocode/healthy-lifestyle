import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  calories: number // 0..1+
  protein: number // 0..1+
  hit?: boolean
}

import { SvgRings } from './SvgRings'

const accentColor = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#B6FF3B'
  return new THREE.Color(v)
}

function Arc({ radius, tube, progress, color, emissive, z = 0 }: { radius: number; tube: number; progress: React.MutableRefObject<number>; color: THREE.Color; emissive: number; z?: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const cap = useRef<THREE.Mesh>(null)
  const start = useRef<THREE.Mesh>(null)
  const shown = useRef(-1)
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
    [color, emissive],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    const p = Math.min(Math.max(progress.current, 0.001), 1)
    if (!mesh.current || Math.abs(p - shown.current) < 0.0005) return
    shown.current = p
    const arc = p * Math.PI * 2
    mesh.current.geometry.dispose()
    mesh.current.geometry = new THREE.TorusGeometry(radius, tube, 20, Math.max(6, Math.ceil(120 * p)), arc)
    mesh.current.rotation.z = Math.PI / 2 - arc
    const a = Math.PI / 2 - arc
    cap.current?.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
  })
  return (
    <group position={[0, 0, z]}>
      <mesh ref={mesh} material={mat}>
        <torusGeometry args={[radius, tube, 20, 6, 0.01]} />
      </mesh>
      <mesh ref={start} position={[0, radius, 0]} material={mat}>
        <sphereGeometry args={[tube, 20, 20]} />
      </mesh>
      <mesh ref={cap} position={[0, radius, 0]} material={mat}>
        <sphereGeometry args={[tube, 20, 20]} />
      </mesh>
    </group>
  )
}

function Scene({ calories, protein, hit }: Props) {
  const group = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Mesh>(null)
  const orb2 = useRef<THREE.Mesh>(null)
  const kProg = useRef(0)
  const pProg = useRef(0)
  const target = useRef({ k: 0, p: 0 })
  const pulse = useRef(0)
  const accent = useMemo(accentColor, [])
  const white = useMemo(() => new THREE.Color('#e9f3ff'), [])
  target.current = { k: Math.min(calories, 1), p: Math.min(protein, 1) }
  useEffect(() => {
    if (hit) pulse.current = 1
  }, [hit])
  const dust = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 60
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 1.9 + Math.random() * 1.1
      arr[i * 3] = Math.cos(a) * r
      arr[i * 3 + 1] = Math.sin(a) * r * 0.7
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [])

  useFrame((st, dt) => {
    // ease progress toward targets (the ring "fills up")
    kProg.current += (target.current.k - kProg.current) * Math.min(1, dt * 3.2)
    pProg.current += (target.current.p - pProg.current) * Math.min(1, dt * 3.2)
    const t = st.clock.elapsedTime
    pulse.current = Math.max(0, pulse.current - dt * 0.8)
    if (group.current) {
      // follow pointer subtly + idle float
      const px = st.pointer.x
      const py = st.pointer.y
      group.current.rotation.y += (px * 0.45 + Math.sin(t * 0.5) * 0.12 - group.current.rotation.y) * 0.06
      group.current.rotation.x += (-py * 0.35 + Math.cos(t * 0.4) * 0.08 - group.current.rotation.x) * 0.06
      group.current.position.y = Math.sin(t * 0.9) * 0.06
      const s = 1 + pulse.current * 0.08 * Math.sin(pulse.current * 18)
      group.current.scale.setScalar(s)
    }
    if (orb.current) {
      const a = t * 0.9
      orb.current.position.set(Math.cos(a) * 2.15, Math.sin(a) * 2.15 * 0.34, Math.sin(a) * 0.9)
    }
    if (orb2.current) {
      const a = -t * 0.6 + 2
      orb2.current.position.set(Math.cos(a) * 1.35, Math.sin(a * 1.3) * 0.5, Math.sin(a) * 1.3)
    }
    dust.rotateZ(dt * 0.03)
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={accent} />
      <pointLight position={[0, 0, 3]} intensity={8} color="#9fd8ff" />
      <group ref={group}>
        {/* glass tracks */}
        {[1.6, 1.12].map((r, i) => (
          <mesh key={r}>
            <torusGeometry args={[r, i === 0 ? 0.17 : 0.14, 24, 120]} />
            <meshPhysicalMaterial color="#cfe4ff" transparent opacity={0.1} roughness={0.05} metalness={0.2} clearcoat={1} />
          </mesh>
        ))}
        <Arc radius={1.6} tube={0.17} progress={kProg} color={accent} emissive={0.65} />
        <Arc radius={1.12} tube={0.14} progress={pProg} color={white} emissive={0.35} z={0.02} />
        {/* glass disc behind */}
        <mesh position={[0, 0, -0.25]}>
          <circleGeometry args={[1.0, 64]} />
          <meshPhysicalMaterial color="#9fb7d8" transparent opacity={0.07} roughness={0} clearcoat={1} />
        </mesh>
      </group>
      <mesh ref={orb}>
        <icosahedronGeometry args={[0.13, 2]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} roughness={0.2} />
      </mesh>
      <mesh ref={orb2}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
      </mesh>
      <points geometry={dust}>
        <pointsMaterial color={accent} size={0.035} transparent opacity={0.7} sizeAttenuation />
      </points>
    </>
  )
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() {
    return { err: true }
  }
  componentDidCatch() {
    /* WebGL unavailable → SVG fallback */
  }
  render() {
    return this.state.err ? this.props.fallback : this.props.children
  }
}

function webglOk() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function Ring3D(props: Props) {
  const ok = useMemo(webglOk, [])
  const fallback = <SvgRings {...props} />
  if (!ok) return fallback
  return (
    <Boundary fallback={fallback}>
      <Canvas camera={{ position: [0, 0, 5.6], fov: 38 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </Boundary>
  )
}
