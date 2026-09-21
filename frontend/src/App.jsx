import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Eye, 
  Flame, 
  Layers, 
  Play, 
  Radio, 
  RefreshCw, 
  ShieldAlert, 
  Sparkles, 
  TrendingUp, 
  Video, 
  Zap 
} from 'lucide-react'
import DigitalTwinViewer from './DigitalTwinViewer.jsx'

export default function App() {
  const [currentMode, setCurrentMode] = useState('robotic') // 'chassis' | 'robotic' | 'manual' | 'stages'
  const [backendOnline, setBackendOnline] = useState(false)

  // Mode 1: Chassis Digital Twin
  const [joints, setJoints] = useState([])
  const [selectedJoint, setSelectedJoint] = useState(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [inspectionResult, setInspectionResult] = useState(null)
  const [activeTab, setActiveTab] = useState('heatmap')

  // Mode 2: Robotic ConvLSTM Telemetry
  const [selectedRoboticVideo, setSelectedRoboticVideo] = useState('video_20260908_170143')
  const [roboticData, setRoboticData] = useState({})
  const [activeRoboticView, setActiveRoboticView] = useState('convlstm') // 'convlstm' | 'telemetry'

  // Mode 3: Manual Fabrication Telemetry
  const [manualData, setManualData] = useState(null)

  // Mode 4: Crane Gallery Stages
  const [stagesData, setStagesData] = useState([])
  const [stageFilter, setStageFilter] = useState('ALL')

  const API_BASE = "http://localhost:8000"

  useEffect(() => {
    fetchHealth()
    fetchJoints()
    fetchRoboticTelemetry()
    fetchManualTelemetry()
    fetchStages()
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
      if (data.length > 0) setSelectedJoint(data[0])
    } catch (e) {
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

  const fetchRoboticTelemetry = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/telemetry/robotic`)
      if (res.ok) {
        const data = await res.json()
        setRoboticData(data)
      }
    } catch (e) {
      console.warn("Robotic telemetry API offline", e)
    }
  }

  const fetchManualTelemetry = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/telemetry/manual`)
      if (res.ok) {
        const data = await res.json()
        setManualData(data)
      }
    } catch (e) {
      console.warn("Manual telemetry API offline", e)
    }
  }

  const fetchStages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/stages`)
      if (res.ok) {
        const data = await res.json()
        setStagesData(data.stages || [])
      }
    } catch (e) {
      console.warn("Stages API offline", e)
    }
  }

  const handleRunInspection = async (jointToInspect = selectedJoint) => {
    if (!jointToInspect) return
    setIsInspecting(true)

    try {
      const formData = new FormData()
      const res = await fetch(`${API_BASE}/api/inspect`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      setTimeout(() => {
        setInspectionResult(data)
        setIsInspecting(false)
        setJoints(prev => prev.map(j => 
          j.id === (jointToInspect.id || 'rear_sus_bracket')
            ? { ...j, status: data.status }
            : j
        ))
      }, 1000)
    } catch (error) {
      console.error("Inspection request failed:", error)
      setIsInspecting(false)
    }
  }

  const currentRobo = roboticData[selectedRoboticVideo] || {}
  const roboTelemetry = currentRobo.telemetry || {}
  const roboConv = currentRobo.convlstm || {}

  const filteredStages = stagesData.filter(s => {
    if (stageFilter === 'ALL') return true
    if (stageFilter === 'ROBOT') return s.section.includes('RF') || s.section.includes('RA')
    return s.section.toUpperCase().includes(stageFilter)
  })

  return (
    <div className="w-screen h-screen relative bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* ---------------------------------------------------------
          TOP NAVIGATION HEADER
      --------------------------------------------------------- */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-6 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold shadow-cyan-500/20 shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-widest text-slate-100 uppercase flex items-center gap-2">
              AutoTwin-AI <span className="text-cyan-400 font-mono">//</span> v2.0 Industrial Telemetry
            </h1>
            <p className="text-[10px] font-mono text-slate-400 tracking-wider">
              SPATIOTEMPORAL CONVLSTM & CRANE FABRICATION DIGITAL TWIN
            </p>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCurrentMode('robotic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              currentMode === 'robotic'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>ROBOTIC CONVLSTM</span>
          </button>

          <button
            onClick={() => setCurrentMode('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              currentMode === 'manual'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>MANUAL FABRICATION</span>
          </button>

          <button
            onClick={() => setCurrentMode('stages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              currentMode === 'stages'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>CRANE STAGES (28)</span>
          </button>

          <button
            onClick={() => setCurrentMode('chassis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              currentMode === 'chassis'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3D CHASSIS (v1.0)</span>
          </button>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-slate-300">API: {backendOnline ? 'ONLINE' : 'STANDALONE'}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>T=8 CONVLSTM</span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------
          MAIN CONTENT AREA BASED ON ACTIVE MODE
      --------------------------------------------------------- */}
      <div className="flex-1 relative flex overflow-hidden">

        {/* =========================================================
            MODE 1: ROBOTIC CONVLSTM VIDEO TELEMETRY
        ========================================================= */}
        {currentMode === 'robotic' && (
          <div className="w-full h-full p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            
            {/* Top Video Selector & Overview Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  SELECT FACTORY SEAM BENCHMARK:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRoboticVideo('video_20260908_170143')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      selectedRoboticVideo === 'video_20260908_170143'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Girder 516 // Seam 1 (Corner, 3m 48s)
                  </button>
                  <button
                    onClick={() => setSelectedRoboticVideo('video_20260908_171604')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      selectedRoboticVideo === 'video_20260908_171604'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Girder 516 // Seam 2 (Flange, 4m 28s)
                  </button>
                </div>
              </div>

              {/* View Switcher: ConvLSTM Anomaly Report vs Telemetry */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveRoboticView('convlstm')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                    activeRoboticView === 'convlstm'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ConvLSTM Next-Frame MSE
                </button>
                <button
                  onClick={() => setActiveRoboticView('telemetry')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                    activeRoboticView === 'telemetry'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Spatter & Arc Telemetry
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Arc-On Time */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase flex items-center justify-between">
                  <span>ARC-ON DURATION</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {roboTelemetry.arc_telemetry?.total_arc_on_formatted || "3m 48s"}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Duty Cycle:</span>
                  <span className="text-emerald-400 font-bold">
                    {roboTelemetry.arc_telemetry?.duty_cycle_pct || 100.0}%
                  </span>
                </div>
              </div>

              {/* Spatter Tracking */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase flex items-center justify-between">
                  <span>SPATTER FREQUENCY</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {roboTelemetry.spatter_telemetry?.average_sparks_per_frame || (selectedRoboticVideo === 'video_20260908_170143' ? "36.87" : "86.95")} <span className="text-xs text-slate-400">sparks/f</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Peak Burst:</span>
                  <span className="text-red-400 font-bold">
                    {roboTelemetry.spatter_telemetry?.peak_sparks_count || (selectedRoboticVideo === 'video_20260908_170143' ? 93 : 297)} sparks
                  </span>
                </div>
              </div>

              {/* Process Stability Index */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center justify-between">
                  <span>PROCESS STABILITY</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {roboTelemetry.stability_telemetry?.process_stability_index_pct || (selectedRoboticVideo === 'video_20260908_170143' ? "95.04%" : "93.29%")}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-bold">CONTROLLED WELD</span>
                </div>
              </div>

              {/* ConvLSTM Next-Frame MSE */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase flex items-center justify-between">
                  <span>CONVLSTM MSE ANOMALY</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-purple-300">
                  {roboConv.anomalous_chunks_count || (selectedRoboticVideo === 'video_20260908_170143' ? 13 : 26)} <span className="text-xs text-slate-400">events &gt; 2.5σ</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Peak Anomaly:</span>
                  <span className="text-red-400 font-bold">
                    t = {roboConv.peak_anomaly?.timestamp_sec || (selectedRoboticVideo === 'video_20260908_170143' ? "28.1s" : "123.3s")}
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Multi-Panel Report Plot */}
            <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold">
                  <BarChart3 className="w-4 h-4" />
                  <span>
                    {activeRoboticView === 'convlstm' 
                      ? `SPATIOTEMPORAL CONVLSTM NEXT-FRAME PREDICTION & ANOMALY REPORT (${selectedRoboticVideo})` 
                      : `ARC-ON & OPENCV SPATTER TELEMETRY TIMELINE (${selectedRoboticVideo})`}
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded">
                  MODEL: ConvLSTM2d Autoencoder (T=8)
                </span>
              </div>

              <div className="flex-1 min-h-[420px] relative rounded-lg overflow-hidden bg-slate-900/50 flex items-center justify-center border border-slate-800">
                <img
                  src={
                    activeRoboticView === 'convlstm'
                      ? `${API_BASE}/static/data/convlstm_anomaly_report_${selectedRoboticVideo}.png`
                      : `${API_BASE}/static/data/telemetry_analysis_${selectedRoboticVideo}.png`
                  }
                  alt="Robotic Telemetry Plot"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to local image path if API static serving is loading
                    e.target.src = `http://localhost:8000/static/data/convlstm_anomaly_report_${selectedRoboticVideo}.png`
                  }}
                />
              </div>
            </div>

          </div>
        )}

        {/* =========================================================
            MODE 2: MANUAL FABRICATION & GRINDING TELEMETRY
        ========================================================= */}
        {currentMode === 'manual' && (
          <div className="w-full h-full p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            
            {/* Header Banner */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-extrabold font-mono text-cyan-400 uppercase flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-400" />
                  MANUAL FABRICATION WORKSTATION // STATION #7 (IMG_3601.MOV)
                </h2>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Human operator manual grinding & fit-up telemetry on Crane Girder 516. Tool contact tracking vs Takt time.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-bold">
                  TOOL ENGAGEMENT: 100.0% ACTIVE
                </div>
              </div>
            </div>

            {/* Manual Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase flex items-center justify-between">
                  <span>ACTIVE GRINDING DURATION</span>
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {manualData?.operator_telemetry?.total_active_grinding_formatted || "5m 26s"}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Continuous Session:</span>
                  <span className="text-cyan-400 font-bold">326.0s contact</span>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase flex items-center justify-between">
                  <span>PEAK GRINDING SPARK STREAM</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {manualData?.operator_telemetry?.peak_spark_count || 449} <span className="text-xs text-slate-400">sparks/f</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Contact Threshold:</span>
                  <span className="text-amber-300 font-bold">&gt;= 8 sparks</span>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase flex items-center justify-between">
                  <span>WORKSTATION MOTION DYNAMICS</span>
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                </span>
                <div className="text-2xl font-bold font-mono text-purple-300">
                  {manualData?.operator_telemetry?.mean_motion_energy || "7.53"} <span className="text-xs text-slate-400">energy</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Operator State:</span>
                  <span className="text-emerald-400 font-bold">HIGH INTENSITY</span>
                </div>
              </div>
            </div>

            {/* Benchmark Correlation against Crane Gallery Stages */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase flex items-center justify-between">
                <span>EXTRAPOLATED CYCLE TIMES FOR MANUAL GRINDING STAGES (CRANE GALLERY BENCHMARK)</span>
                <span className="text-[10px] text-slate-400">TAKT TIME: 227 MIN</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(manualData?.crane_gallery_benchmark_correlation || [
                  { seq: 5, stage_name: "I Beam UT & Cleaning (Grinder)", total_cycle_min: 200, takt_min: 227, estimated_net_grinding_min: 200, takt_compliance: "PASS (WITHIN TAKT)" },
                  { seq: 9, stage_name: "UT inspection & Cleaning (Grinder)", total_cycle_min: 120, takt_min: 227, estimated_net_grinding_min: 120, takt_compliance: "PASS (WITHIN TAKT)" },
                  { seq: 19, stage_name: "Assy cleaning & FW (Grinder)", total_cycle_min: 160, takt_min: 227, estimated_net_grinding_min: 160, takt_compliance: "PASS (WITHIN TAKT)" }
                ]).map((stage) => (
                  <div key={stage.seq} className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-200">
                      #{stage.seq} {stage.stage_name}
                    </span>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Standard Cycle:</span>
                      <span className="text-slate-100 font-bold">{stage.total_cycle_min} min</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Takt Compliance:</span>
                      <span className="text-emerald-400 font-bold">{stage.takt_compliance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Embedded Visual Analytics Plot */}
            <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-2xl overflow-hidden min-h-[420px]">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                MANUAL FABRICATION TELEMETRY TIMELINE (TOOL STATUS, SPARK STREAM & WORKSTATION ENERGY)
              </span>
              <div className="flex-1 relative rounded-lg overflow-hidden bg-slate-900/50 flex items-center justify-center border border-slate-800">
                <img
                  src={`${API_BASE}/static/data/manual_telemetry_analysis_IMG_3601.png`}
                  alt="Manual Telemetry Plot"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

          </div>
        )}

        {/* =========================================================
            MODE 3: CRANE GALLERY 28-STAGE TAKT TRACKER
        ========================================================= */}
        {currentMode === 'stages' && (
          <div className="w-full h-full p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            
            {/* Header & Filter Controls */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-extrabold font-mono text-cyan-400 uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  CRANE GALLERY ASSEMBLY // 28-STAGE TAKT TIME TRACKER
                </h2>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Master fabrication sequence calibrated from crane_gallery_stages.xlsx. Standard Takt Time = 227 Minutes.
                </p>
              </div>

              {/* Section Filters */}
              <div className="flex flex-wrap gap-1.5">
                {['ALL', 'TAPER PLATE', 'I-BEAM', 'NODE', 'TUBE', 'ASSEMBLY', 'ROBOT'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStageFilter(f)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                      stageFilter === f
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Stages Table */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="p-3">Seq</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Stage / Activity</th>
                    <th className="p-3">Man Power</th>
                    <th className="p-3">Cycle Time</th>
                    <th className="p-3">Takt Time</th>
                    <th className="p-3">Variance vs Takt</th>
                    <th className="p-3">Tracking Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStages.map((stage) => {
                    const isRobot = stage.section.includes('RF') || stage.section.includes('RA')
                    return (
                      <tr key={stage.seq} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-bold text-cyan-400">#{stage.seq}</td>
                        <td className="p-3 text-slate-300">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isRobot 
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40' 
                              : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}>
                            {stage.section}
                          </span>
                        </td>
                        <td className="p-3 text-slate-100 font-semibold">{stage.stage}</td>
                        <td className="p-3 text-slate-400">{stage.man_power} op</td>
                        <td className="p-3 font-bold text-slate-200">{stage.cycle_time_min} min</td>
                        <td className="p-3 text-slate-400">{stage.takt_time_min} min</td>
                        <td className="p-3 font-bold text-emerald-400">
                          {stage.variance_min} min
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                            {stage.tracking_status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* =========================================================
            MODE 4: 3D CHASSIS DIGITAL TWIN (v1.0)
        ========================================================= */}
        {currentMode === 'chassis' && (
          <>
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

            {/* LEFT SIDEBAR: TELEMETRY & HOTSPOT CONTROLS */}
            <aside className="w-[430px] max-w-[90vw] h-full z-10 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar pointer-events-auto pb-16">
              <div className="bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-2xl flex flex-col gap-3">
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
                              ? 'bg-red-950/40 border-red-500/80'
                              : 'bg-cyan-950/40 border-cyan-500/80'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isDefective ? 'bg-red-400 animate-pulse' : 'bg-cyan-400'}`} />
                            {joint.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            X: {joint.position[0] > 0 ? `+${joint.position[0].toFixed(2)}` : joint.position[0].toFixed(2)}m · Y: +{joint.position[1].toFixed(2)}m
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

                <button
                  onClick={() => handleRunInspection(selectedJoint)}
                  disabled={isInspecting}
                  className={`w-full py-3 px-4 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all relative overflow-hidden ${
                    isInspecting
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 cursor-wait'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
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

              {/* Inspection Results Panel */}
              {inspectionResult && (
                <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-xl border border-red-500/60 rounded-xl p-4 shadow-2xl flex flex-col gap-3.5">
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
                      <span className="text-[9px] text-slate-500">Confidence: 96.5%</span>
                    </div>
                  </div>

                  <div className="relative rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900">
                    <img
                      src={activeTab === 'heatmap' ? inspectionResult.heatmap_url : inspectionResult.defect_render_url}
                      alt="AI Anomaly Inspection"
                      className="w-full h-40 object-cover object-center"
                    />
                  </div>
                </div>
              )}
            </aside>
          </>
        )}

      </div>
    </div>
  )
}
