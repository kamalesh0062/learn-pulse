import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Cpu, Activity, CheckCircle2, Shield, Eye, AlertCircle } from 'lucide-react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export const StandaloneVisionTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animRef = useRef<number | null>(null);

  const [status, setStatus] = useState<string>('Initializing WebAssembly...');
  const [fps, setFps] = useState<number>(0);
  const [state, setState] = useState<string>('OFFLINE');
  const [pitch, setPitch] = useState<number>(0);
  const [yaw, setYaw] = useState<number>(0);
  const [ear, setEar] = useState<number>(0.30);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>(['[SYSTEM] Vision Test Suite Loaded.']);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-30), `[${time}] ${msg}`]);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        addLog("Loading MediaPipe Tasks Vision WebAssembly Bundle...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });
        if (mounted) {
          landmarkerRef.current = landmarker;
          setStatus('Ready to Start Camera');
          addLog("MediaPipe FaceLandmarker initialized successfully!");
        }
      } catch (err: any) {
        addLog(`MediaPipe init error: ${err.message}`);
        setStatus('MediaPipe Error');
      }
    };

    init();

    return () => {
      mounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, []);

  const startStream = async () => {
    try {
      addLog("Requesting getUserMedia stream...");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('Camera Streaming');
      addLog(`Webcam active! Stream tracks: ${stream.getVideoTracks().length}`);
      startLoop();
    } catch (err: any) {
      addLog(`Camera error: ${err.message}`);
      setStatus('Camera Error');
    }
  };

  const stopStream = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('Stopped');
    setFps(0);
    setFaceDetected(false);
    addLog("Camera stream stopped.");
  };

  const startLoop = () => {
    let frameCount = 0;
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && landmarkerRef.current) {
        try {
          const results = landmarkerRef.current.detectForVideo(video, now);
          
          if (canvas && video.videoWidth > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];
                setFaceDetected(true);

                // Compute Nose & Eye metrics
                const nose = landmarks[1];
                const chin = landmarks[152];
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];

                const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
                const eyeMidX = (leftEye.x + rightEye.x) / 2;
                const calcYaw = Math.max(-90, Math.min(90, ((nose.x - eyeMidX) / (eyeDist / 2)) * 65));
                const calcPitch = Math.max(-90, Math.min(90, ((nose.y - (leftEye.y + 0.05)) / 0.15) * 50));

                const p1 = landmarks[33], p2 = landmarks[160], p3 = landmarks[158], p4 = landmarks[133], p5 = landmarks[153], p6 = landmarks[144];
                const calcEar = (Math.hypot(p2.x - p6.x, p2.y - p6.y) + Math.hypot(p3.x - p5.x, p3.y - p5.y)) / (2.0 * Math.hypot(p1.x - p4.x, p1.y - p4.y));

                setYaw(Math.round(calcYaw * 10) / 10);
                setPitch(Math.round(calcPitch * 10) / 10);
                setEar(Math.round(calcEar * 1000) / 1000);

                const computedState = (Math.abs(calcYaw) > 28 || Math.abs(calcPitch) > 25) ? 'DISTRACTED' : (calcEar < 0.18 ? 'LOW ENGAGEMENT' : 'FOCUSED');
                setState(computedState);

                // Draw Mesh Dots
                ctx.fillStyle = computedState === 'FOCUSED' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)';
                for (let i = 0; i < landmarks.length; i += 3) {
                  const pt = landmarks[i];
                  ctx.beginPath();
                  ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.4, 0, 2 * Math.PI);
                  ctx.fill();
                }
              } else {
                setFaceDetected(false);
                setState('AWAY');
              }
            }
          }
        } catch (e: any) {
          console.warn("Detection error:", e);
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card rounded-2xl p-6 flex justify-between items-center border border-dark-border">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase">
            <Cpu className="w-4 h-4" />
            <span>Standalone Vision Test Page</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Isolated Computer Vision & Mesh Tester</h1>
          <p className="text-xs text-slate-300 mt-1">Direct testing for webcam acquisition and MediaPipe 468 3D landmark mesh extraction.</p>
        </div>

        <div className="flex space-x-3">
          <button onClick={startStream} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2">
            <Camera className="w-4 h-4" />
            <span>Start Camera Stream</span>
          </button>
          <button onClick={stopStream} className="px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs">
            Stop Camera
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-4 space-y-4 border border-dark-border">
          <div className="flex justify-between items-center font-mono text-xs">
            <span className="text-slate-300 font-bold">WEBCAM PREVIEW & LIVE MESH</span>
            <span className="px-2 py-1 bg-black/60 rounded text-emerald-400">FPS: {fps}</span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-white/10">
            <video ref={videoRef} playsInline muted autoPlay style={{ transform: 'scaleX(-1)' }} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} style={{ transform: 'scaleX(-1)' }} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5 border border-dark-border space-y-3 font-mono">
            <h3 className="text-xs font-bold text-slate-300 uppercase">Status & Feature Signal</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                <div className="text-slate-400 text-[10px]">STATE</div>
                <div className={`text-base font-bold mt-1 ${state === 'FOCUSED' ? 'text-emerald-400' : 'text-rose-400'}`}>{state}</div>
              </div>
              <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                <div className="text-slate-400 text-[10px]">FACE DETECTED</div>
                <div className="text-base font-bold text-white mt-1">{faceDetected ? 'YES (1.0)' : 'NO (0.0)'}</div>
              </div>
              <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                <div className="text-slate-400 text-[10px]">HEAD POSE</div>
                <div className="text-sm font-bold text-white mt-1">P:{pitch}° | Y:{yaw}°</div>
              </div>
              <div className="p-3 bg-dark-bg rounded-xl border border-dark-border">
                <div className="text-slate-400 text-[10px]">EAR</div>
                <div className="text-sm font-bold text-white mt-1">EAR: {ear}</div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-dark-border space-y-2 font-mono text-xs">
            <div className="text-slate-300 font-bold">SYSTEM LOGS</div>
            <div className="h-40 overflow-y-auto bg-black p-3 rounded-xl text-[11px] text-emerald-400 space-y-1">
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
