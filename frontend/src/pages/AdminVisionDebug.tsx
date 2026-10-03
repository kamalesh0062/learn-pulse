import React, { useState, useEffect } from 'react';
import { Shield, Camera, Cpu, Activity, Server, Clock, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { LiveCamera } from '../components/video/LiveCamera';
import { engagementApi } from '../services/api';

export const AdminVisionDebug: React.FC = () => {
  const [debugState, setDebugState] = useState<string>('Focused');
  const [debugConfidence, setDebugConfidence] = useState<number>(95);
  const [debugMetrics, setDebugMetrics] = useState<any>({
    pitch: 0,
    yaw: 0,
    roll: 0,
    ear: 0.30,
    gaze_offset: 0.05,
    face_detected: true,
    fps: 0
  });

  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [inferenceLatency, setInferenceLatency] = useState<number>(12); // ms
  const [apiPingStatus, setApiPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Measure backend API roundtrip latency
  const testBackendConnection = async () => {
    setApiPingStatus('testing');
    const start = performance.now();
    try {
      await engagementApi.predict({
        pitch: 2.1,
        yaw: -3.5,
        roll: 1.0,
        ear: 0.32,
        gaze_offset: 0.06,
        face_detected: true
      });
      const end = performance.now();
      setBackendLatency(Math.round(end - start));
      setApiPingStatus('success');
    } catch (err) {
      console.error("Backend latency test failed:", err);
      setApiPingStatus('error');
      setBackendLatency(null);
    }
  };

  useEffect(() => {
    testBackendConnection();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-purple-950/30 border border-purple-500/40 rounded-2xl p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            <span>Developer / Administrator Computer Vision Diagnostics</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading mt-1">
            MediaPipe & Model Inference Debug Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time inspection of browser WebAssembly landmark extraction, feature vectors, local inference, and backend synchronization latency.
          </p>
        </div>

        <button
          onClick={testBackendConnection}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-glow"
        >
          <RefreshCw className={`w-4 h-4 ${apiPingStatus === 'testing' ? 'animate-spin' : ''}`} />
          <span>Ping FastAPI Backend</span>
        </button>
      </div>

      {/* Latency & Hardware Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
        <div className="glass-card rounded-xl p-4 border border-dark-border">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Camera & Vision FPS</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-2">
            {debugMetrics.fps || 30} FPS
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Local WebAssembly Canvas Loop</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-dark-border">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>WASM Inference Latency</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-400 mt-2">
            ~{inferenceLatency} ms
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Client-Side Random Forest Engine</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-dark-border">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Backend Event Latency</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-400 mt-2">
            {backendLatency !== null ? `${backendLatency} ms` : 'Offline / Error'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">FastAPI POST /engagement/events</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-dark-border">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Facial Mesh Landmarks</span>
            <Eye className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2">
            {debugMetrics.face_detected ? '468 3D Points' : '0 (No Face)'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">MediaPipe FaceLandmarker Task</div>
        </div>
      </div>

      {/* Main Grid: Live Camera Stream & Signal Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Camera View */}
        <div>
          <LiveCamera
            lectureId={1}
            topicId={1}
            videoCurrentTime={45}
            isPlaying={true}
            showControls={true}
            persistEvents={false}
            onStateUpdate={(state, conf, met) => {
              setDebugState(state);
              setDebugConfidence(conf);
              setDebugMetrics(met);
            }}
          />
        </div>

        {/* Feature Inspection Panel */}
        <div className="glass-card rounded-2xl p-6 border border-dark-border space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Raw Feature Vector Breakdown
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {/* Face Detection */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">face_detected</span>
              <span className={`font-bold px-2 py-0.5 rounded ${debugMetrics.face_detected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {debugMetrics.face_detected ? 'TRUE (1.0)' : 'FALSE (0.0)'}
              </span>
            </div>

            {/* Pitch */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">head_pitch (Vertical Tilt)</span>
              <span className="text-white font-bold">{debugMetrics.pitch || 0.0}°</span>
            </div>

            {/* Yaw */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">head_yaw (Horizontal Turn)</span>
              <span className="text-white font-bold">{debugMetrics.yaw || 0.0}°</span>
            </div>

            {/* Roll */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">head_roll (Head Tilt Angle)</span>
              <span className="text-white font-bold">{debugMetrics.roll || 0.0}°</span>
            </div>

            {/* EAR */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">ear (Eye Aspect Ratio)</span>
              <span className="text-emerald-400 font-bold">{debugMetrics.ear || 0.30}</span>
            </div>

            {/* Gaze Offset */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="text-slate-400">gaze_offset (Deviation Index)</span>
              <span className="text-amber-400 font-bold">{debugMetrics.gaze_offset || 0.05}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-2">
            <div className="text-xs font-bold text-slate-300">Model Inference Verdict:</div>
            <div className="flex items-center space-x-3">
              <span className="text-lg font-extrabold text-brand-400">{debugState.toUpperCase()}</span>
              <span className="text-xs text-slate-400">Confidence: {debugConfidence}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVisionDebug;
