import React, { Suspense, useState, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Html, Center, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'
import { Compass, Eye, Maximize2 } from 'lucide-react'

// ---------------------------------------------------------
// 3D Chassis Model Loader
// ---------------------------------------------------------
function ChassisMesh({ url, onMeshClick }) {
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
      rotation={[-Math.PI / 2, 0, 0]} 
      scale={[0.01, 0.01, 0.01]}
      onPointerDown={(e) => {
        e.stopPropagation()
        const x = parseFloat(e.point.x.toFixed(3))
        const y = parseFloat(e.point.y.toFixed(3))
        const z = parseFloat(e.point.z.toFixed(3))
        console.log(`%c[CAD Coordinate Tool] New Joint Coord: [${x}, ${y}, ${z}]`, 'color: #00f0ff; font-weight: bold; font-size: 13px; background: #0a0d14; padding: 4px;')
        if (onMeshClick) onMeshClick([x, y, z])
      }}
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

      {/* 3D Floating Tag / Tooltip */}
      <Html
        position={[0, 0.14, 0]}
        center
        distanceFactor={6}
        className="pointer-events-none transition-opacity duration-300"
      >
        <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap backdrop-blur-md transition-all shadow-xl ${
          isDefective 
            ? 'bg-red-950/90 border-red-500 text-red-200 shadow-red-500/30' 
            : 'bg-slate-900/90 border-cyan-500/60 text-cyan-300 shadow-cyan-500/20'
        }`}>
          <div className="flex items-center gap-1.5 font-bold">
            <span className={`w-2 h-2 rounded-full ${isDefective ? 'bg-red-500 animate-ping' : 'bg-cyan-400'}`} />
            {joint.name}
          </div>
          <div className="text-[10px] text-slate-300 font-mono mt-0.5 flex gap-2">
            <span>X: {joint.position[0].toFixed(2)}m</span>
            <span>Y: {joint.position[1].toFixed(2)}m</span>
            <span>Z: {joint.position[2].toFixed(2)}m</span>
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
  const [lastClicked, setLastClicked] = useState(null)
  const cadUrl = "http://localhost:8000/static/cad/28000.obj"

  // Preset camera angle snapping
  const setCameraView = (x, y, z) => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(x, y, z)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }

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

        {/* 3D CAD Chassis Object & Accurately Aligned Hotspots */}
        <Suspense fallback={
          <Html center>
            <div className="flex flex-col items-center gap-2 p-4 bg-slate-900/90 border border-cyan-500/50 rounded-lg backdrop-blur-md">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-cyan-400 tracking-wider">LOADING CHASSIS CAD (28000.OBJ)...</span>
            </div>
          </Html>
        }>
          <group position={[0, -0.1, 0]}>
            <Center top>
              <ChassisMesh url={cadUrl} onMeshClick={setLastClicked} />
            </Center>
            
            {/* Interactive Hotspot Spheres (Direct CAD Vertex Centroids) */}
            {joints.map((joint) => (
              <JointHotspot
                key={joint.id}
                joint={joint}
                isSelected={selectedJointId === joint.id}
                onClick={onSelectJoint}
              />
            ))}
          </group>
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

        {/* 3D CAD Orientation Gizmo (X: Red, Y: Green, Z: Blue) */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport 
            axisColors={['#ef4444', '#10b981', '#3b82f6']} 
            labelColor="#ffffff" 
          />
        </GizmoHelper>
      </Canvas>

      {/* Quick Camera Viewport Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950/85 border border-slate-800/90 p-1.5 rounded-xl backdrop-blur-xl z-10 shadow-2xl text-xs font-mono">
        <span className="text-[10px] text-slate-400 px-1.5 flex items-center gap-1 font-semibold">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          VIEW:
        </span>
        <button
          onClick={() => setCameraView(5.0, 3.2, 5.0)}
          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition-all"
        >
          ISO
        </button>
        <button
          onClick={() => setCameraView(0.0, 8.0, 0.001)}
          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition-all"
        >
          TOP
        </button>
        <button
          onClick={() => setCameraView(0.0, 1.0, 6.0)}
          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition-all"
        >
          SIDE
        </button>
        <button
          onClick={() => setCameraView(-6.0, 1.0, 0.0)}
          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 transition-all"
        >
          FRONT
        </button>
      </div>

      {/* Live Click-to-Find CAD Coordinate Toast Badge */}
      {lastClicked && (
        <div className="absolute top-16 right-4 flex items-center gap-2.5 bg-cyan-950/95 border border-cyan-400 text-cyan-200 px-3.5 py-2 rounded-xl backdrop-blur-xl shadow-2xl z-20 text-xs font-mono animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>📍 CLICKED CAD COORD: [{lastClicked.map(v => v.toFixed(3)).join(', ')}]</span>
        </div>
      )}


      {/* Viewport Status Badge */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg backdrop-blur-md text-[11px] text-slate-400 font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>THREE.JS 3D CANVAS // GIZMO ORIENTATION ACTIVE</span>
      </div>
    </div>
  )
}
