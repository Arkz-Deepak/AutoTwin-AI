import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Eye, 
  Layers, 
  Play, 
  Radio, 
  RefreshCw, 
  ShieldAlert, 
  Sparkles,
  Zap
} from 'lucide-react'
import DigitalTwinViewer from './DigitalTwinViewer.jsx'

export default function App() {
  const [joints, setJoints] = useState([])
  const [selectedJoint, setSelectedJoint] = useState(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [inspectionResult, setInspectionResult] = useState(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [activeTab, setActiveTab] = useState('heatmap') // 'heatmap' | 'defective'

  const API_BASE = "http://localhost:8000"

  // Fetch Hotspot Joints and Health on mount
  useEffect(() => {
    fetchHealth()
    fetchJoints()
  }, [])

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      if (res.ok) setBackendOnline(true)
    } catch (e) {
      setBackendOnline(false)
    }
  }

  const fetchJoints = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/joints`)
      const data = await res.json()
      setJoints(data)
      if (data.length > 0) {
        setSelectedJoint(data[0])
      }
    } catch (e) {
      console.error("Failed to load joints:", e)
      // Fallback default joint
      const defaultJoint = {
        id: "rear_sus_bracket",
        name: "Rear Suspension Bracket",
        position: [1.5, 0.5, 0.1],
        status: "PENDING",
        description: "Rear suspension spring perch and frame cross-member junction"
      }
      setJoints([defaultJoint])
      setSelectedJoint(defaultJoint)
    }
  }

  // Trigger AI Inspection Endpoint
  const handleRunInspection = async (jointToInspect = selectedJoint) => {
    if (!jointToInspect) return
    setIsInspecting(true)

    try {
      // Simulate/call POST /api/inspect
      const formData = new FormData()
      const res = await fetch(`${API_BASE}/api/inspect`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      // Artificial small delay for high-tech scanning effect
      setTimeout(() => {
        setInspectionResult(data)
        setIsInspecting(false)

        // Update joint status in local list
        setJoints(prev => prev.map(j => 
          j.id === (jointToInspect.id || 'rear_sus_bracket')
            ? { ...j, status: data.status }
            : j
        ))
      }, 1200)

    } catch (error) {
      console.error("Inspection request failed:", error)
      setIsInspecting(false)
    }
  }

  return (
    <div className="w-screen h-screen relative bg-[#0a0d14] text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* ---------------------------------------------------------
          TOP NAVIGATION HEADER
      --------------------------------------------------------- */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-slate-100 uppercase flex items-center gap-2">
              AutoTwin <span className="text-cyan-400 font-mono">//</span> Chassis Digital Twin
            </h1>
            <p className="text-[10px] font-mono text-slate-400 tracking-wider">
              CAD ASSET: 28000.OBJ | 361,174 VERTICES
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-slate-300">API: {backendOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>GPU: RTX 3050 (OPTIX)</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>STREAM: 60 FPS</span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------
          MAIN CONTENT AREA (SIDEBAR + 3D VIEWPORT)
      --------------------------------------------------------- */}
      <div className="flex-1 relative flex overflow-hidden">

        {/* 3D WEBGL CANVAS BACKGROUND */}
        <div className="absolute inset-0 z-0">
          <DigitalTwinViewer
            joints={joints}
            selectedJointId={selectedJoint?.id}
            onSelectJoint={(joint) => {
              setSelectedJoint(joint)
              handleRunInspection(joint)
            }}
          />
        </div>

        {/* ---------------------------------------------------------
            LEFT SIDEBAR: TELEMETRY & INSPECTION CONTROLS
        --------------------------------------------------------- */}
        <aside className="w-[420px] max-w-[90vw] h-full z-10 p-4 flex flex-col gap-4 pointer-events-none">
          
          {/* Telemetry & Joint Info Card */}
          <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 tracking-wider">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>TELEMETRY & CAD HOTSPOTS</span>
              </div>
              <button 
                onClick={fetchJoints}
                className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                title="Refresh Hotspots"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hotspots List */}
            <div className="flex flex-col gap-2">
              {joints.map((joint) => {
                const isSelected = selectedJoint?.id === joint.id
                const isDefective = joint.status === 'ANOMALY_DETECTED'

                return (
                  <div
                    key={joint.id}
                    onClick={() => setSelectedJoint(joint)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                      isSelected
                        ? isDefective
                          ? 'bg-red-950/40 border-red-500/80 neon-glow-red'
                          : 'bg-cyan-950/40 border-cyan-500/80 neon-glow-cyan'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isDefective ? 'bg-red-400 animate-pulse' : 'bg-cyan-400'}`} />
                        {joint.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Pos: [{joint.position.map(v => v.toFixed(2)).join(', ')}]
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                      isDefective
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : joint.status === 'NOMINAL'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-amber-500/20 border-amber-500 text-amber-300'
                    }`}>
                      {joint.status}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Run AI Inspection Trigger Button */}
            <button
              onClick={() => handleRunInspection(selectedJoint)}
              disabled={isInspecting}
              className={`w-full py-3 px-4 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all relative overflow-hidden ${
                isInspecting
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 cursor-wait scanline-effect'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-[0.98]'
              }`}
            >
              {isInspecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ANALYZING JOINT TOPOLOGY...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-950 fill-current" />
                  <span>RUN AI INSPECTION (AUTOENCODER)</span>
                </>
              )}
            </button>
          </div>

          {/* ---------------------------------------------------------
              AI INSPECTION RESULTS & HEATMAP PANEL
          --------------------------------------------------------- */}
          {inspectionResult && (
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-xl border border-red-500/60 rounded-xl p-4 shadow-2xl flex flex-col gap-3.5 animate-in fade-in slide-in-from-left duration-300">
              
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-mono font-bold text-red-400 tracking-wider uppercase">
                    {inspectionResult.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded font-bold">
                  SEVERITY: {inspectionResult.severity}
                </span>
              </div>

              {/* Anomaly Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400">ANOMALY SCORE</span>
                  <span className="text-base font-bold text-red-400">
                    {inspectionResult.anomaly_score}
                  </span>
                  <span className="text-[9px] text-slate-500">Threshold &gt; 0.050</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400">DEFECT PROBABILITY</span>
                  <span className="text-base font-bold text-amber-400">
                    {inspectionResult.defect_probability}%
                  </span>
                  <span className="text-[9px] text-slate-500">Confidence: {inspectionResult.confidence * 100}%</span>
                </div>
              </div>

              {/* Image Tabs (Heatmap vs Defect Frame) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    INSPECTION RESIDUAL HEATMAP
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTab('heatmap')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                        activeTab === 'heatmap'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3-Panel
                    </button>
                    <button
                      onClick={() => setActiveTab('defective')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                        activeTab === 'defective'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      CAD Slag
                    </button>
                  </div>
                </div>

                {/* Heatmap Preview Display */}
                <div className="relative rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900 group">
                  <img
                    src={activeTab === 'heatmap' ? inspectionResult.heatmap_url : inspectionResult.defect_render_url}
                    alt="AI Anomaly Inspection"
                    className="w-full h-40 object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-slate-300 truncate">
                    {activeTab === 'heatmap' 
                      ? 'Reconstruction Absolute Error: |Input - Recon|' 
                      : 'Physical Injected Slag Anomaly'}
                  </div>
                </div>
              </div>

              {/* Recommendation Notice */}
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-[11px] font-mono text-amber-200/90 leading-tight">
                <span className="font-bold text-amber-400 block mb-0.5">⚠️ ACTION ADVISORY:</span>
                {inspectionResult.recommendation}
              </div>

            </div>
          )}

        </aside>

      </div>
    </div>
  )
}
