import React, { Suspense, useState, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Html, Center, Grid, Float } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'

// ---------------------------------------------------------
// 3D Chassis Model Loader
// ---------------------------------------------------------
function ChassisMesh({ url }) {
  const obj = useLoader(OBJLoader, url)

  // Apply industrial metallic PBR material across all meshes
  React.useMemo(() => {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x94a3b8),
          metalness: 0.85,
          roughness: 0.28,
          envMapIntensity: 1.2
        })
      }
    })
  }, [obj])

  return (
    <primitive 
      object={obj} 
      position={[0, 0, 0]} 
      rotation={[0, 0, 0]} 
      scale={[0.01, 0.01, 0.01]}
    />
  )
}

// ---------------------------------------------------------
// Interactive Glowing Joint Hotspot Marker
// ---------------------------------------------------------
function JointHotspot({ joint, isSelected, onClick }) {
  const meshRef = useRef()
  const ringRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Pulsing glow animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (meshRef.current) {
      const scale = 1.0 + Math.sin(t * 3.5) * 0.15
      meshRef.current.scale.set(scale, scale, scale)
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.2
      const ringScale = 1.0 + Math.sin(t * 2.0) * 0.2
      ringRef.current.scale.set(ringScale, ringScale, ringScale)
    }
  })

  const isDefective = joint.status === 'ANOMALY_DETECTED' || isSelected
  const hotspotColor = isDefective ? '#ef4444' : '#00f0ff'

  return (
    <group position={joint.position}>
      {/* Outer Pulse Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.11, 32]} />
        <meshBasicMaterial 
          color={hotspotColor} 
          side={THREE.DoubleSide} 
          transparent 
          opacity={0.7} 
        />
      </mesh>

      {/* Core Glowing Hotspot Sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(joint)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[0.045, 32, 32]} />
        <meshStandardMaterial
          color={hotspotColor}
          emissive={hotspotColor}
          emissiveIntensity={hovered || isSelected ? 3.5 : 2.0}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* 3D Floating Cyberpunk Tag / Tooltip */}
      <Html
        position={[0, 0.12, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none transition-opacity duration-300"
      >
        <div className={`px-2.5 py-1 rounded border text-xs font-mono whitespace-nowrap backdrop-blur-md transition-all ${
          isDefective 
            ? 'bg-red-950/80 border-red-500 text-red-200 neon-glow-red' 
            : 'bg-slate-900/80 border-cyan-500/60 text-cyan-300 neon-glow-cyan'
        }`}>
          <div className="flex items-center gap-1.5 font-semibold">
            <span className={`w-2 h-2 rounded-full ${isDefective ? 'bg-red-500 animate-ping' : 'bg-cyan-400'}`} />
            {joint.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Coord: [{joint.position.map(v => v.toFixed(2)).join(', ')}]
          </div>
        </div>
      </Html>
    </group>
  )
}

// ---------------------------------------------------------
// Main Digital Twin 3D Viewport Component
// ---------------------------------------------------------
export default function DigitalTwinViewer({ joints, selectedJointId, onSelectJoint }) {
  const controlsRef = useRef()
  const cadUrl = "http://localhost:8000/static/cad/28000.obj"

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [5.0, 3.2, 5.0], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        {/* Environment Lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight 
          position={[5, 10, 7]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
        />
        <directionalLight position={[-5, -2, -5]} intensity={0.4} color="#00f0ff" />
        <pointLight position={[0, 3, 0]} intensity={0.8} color="#ffffff" />

        {/* Industrial Ground Grid */}
        <Grid
          position={[0, -0.6, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={2.0}
          sectionThickness={1.2}
          sectionColor="#00f0ff"
          fadeDistance={15}
          fadeStrength={1.5}
        />

        {/* 3D CAD Chassis Object */}
        <Suspense fallback={
          <Html center>
            <div className="flex flex-col items-center gap-2 p-4 bg-slate-900/90 border border-cyan-500/50 rounded-lg backdrop-blur-md">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-cyan-400 tracking-wider">LOADING CHASSIS CAD (28000.OBJ)...</span>
            </div>
          </Html>
        }>
          <Center top position={[0, -0.5, 0]}>
            <ChassisMesh url={cadUrl} />
            
            {/* Interactive Hotspot Spheres */}
            {joints.map((joint) => (
              <JointHotspot
                key={joint.id}
                joint={joint}
                isSelected={selectedJointId === joint.id}
                onClick={onSelectJoint}
              />
            ))}
          </Center>
        </Suspense>

        {/* Viewport OrbitControls */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={1.0}
          maxDistance={15.0}
          maxPolarAngle={Math.PI / 2 + 0.1}
        />
      </Canvas>

      {/* Viewport Overlay Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-lg backdrop-blur-md text-xs text-slate-400 font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>THREE.JS WEBGL RENDERER ACTIVE</span>
      </div>
    </div>
  )
}
