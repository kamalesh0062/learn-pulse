import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Shield, AlertTriangle, RefreshCw, CheckCircle2, Wifi, WifiOff, Eye, UserCheck, Users } from 'lucide-react';
import { engagementApi } from '../../services/api';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

interface LiveCameraProps {
  lectureId: number;
  topicId?: number;
  videoCurrentTime?: number;
  isPlaying?: boolean;
  onStateUpdate?: (state: string, confidence: number, metrics: any) => void;
  showControls?: boolean;
  compact?: boolean;
  autoStart?: boolean;
  /** When false the camera runs for local preview only and nothing is sent to the backend. */
  persistEvents?: boolean;
}

interface FrameMetrics {
  pitch: number;
  yaw: number;
  roll: number;
  ear: number;
  gaze_offset: number;
  face_detected: boolean;
  state: string;
  confidence: number;
  timestamp: number;
}

export const LiveCamera: React.FC<LiveCameraProps> = ({
  lectureId,
  topicId,
  videoCurrentTime = 0,
  isPlaying = true,
  onStateUpdate,
  showControls = true,
  compact = false,
  autoStart = true,
  persistEvents = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Status States
  const [cameraState, setCameraState] = useState<'off' | 'starting' | 'active' | 'permission_denied' | 'error' | 'unavailable'>('off');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected'>('connected');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [multiFaceDetected, setMultiFaceDetected] = useState<boolean>(false);

  // Real-time CV Engagement Signals
  const [currentState, setCurrentState] = useState<string>('Focused');
  const [confidence, setConfidence] = useState<number>(95);
  const [metrics, setMetrics] = useState<{
    pitch: number;
    yaw: number;
    roll: number;
    ear: number;
    gaze_offset: number;
    face_detected: boolean;
    fps: number;
  }>({
    pitch: 0,
    yaw: 0,
    roll: 0,
    ear: 0.30,
    gaze_offset: 0.05,
    face_detected: true,
    fps: 0
  });

  // Buffers for Temporal Smoothing, Blink Suppression & 5-Second Aggregation
  const rollingWindowRef = useRef<FrameMetrics[]>([]);
  const offlineQueueRef = useRef<any[]>([]);
  const lastNoFaceTimeRef = useRef<number | null>(null);
  const lastEventSentTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsCheckRef = useRef<number>(Date.now());
  
  // Accuracy & Robustness Refs (Blink Suppression & Adaptive EAR)
  const blinkStartTimeRef = useRef<number | null>(null);
  const openEarHistoryRef = useRef<number[]>([]);
  const adaptiveBaselineEarRef = useRef<number>(0.30);
  const currentStateRef = useRef<string>('Focused');

  // Latest playback context, read by the aggregation callback without re-creating the frame loop
  const playbackRef = useRef({ lectureId, topicId, videoCurrentTime });
  playbackRef.current = { lectureId, topicId, videoCurrentTime };

  // Initialize MediaPipe FaceLandmarker Task in Browser WebAssembly
  useEffect(() => {
    let isMounted = true;
    const initLandmarker = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 2
        });
        if (isMounted) {
          landmarkerRef.current = landmarker;
        }
      } catch (err) {
        console.warn("[MediaPipe] GPU delegate fallback to CPU:", err);
        try {
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
          );
          const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numFaces: 2
          });
          if (isMounted) {
            landmarkerRef.current = landmarker;
          }
        } catch (cpuErr) {
          console.error("[MediaPipe] Vision Landmarker initialization failed:", cpuErr);
        }
      }
    };

    initLandmarker();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Stop camera tracks and release webcam device
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('off');
    setIsProcessing(false);
  }, []);

  // Request browser camera stream
  const startCamera = useCallback(async () => {
    setErrorMessage('');
    setCameraState('starting');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setErrorMessage('Browser does not support getUserMedia camera access.');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
      } catch (fallbackErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      setCameraState('active');
      setIsProcessing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video play notice:", e);
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('permission_denied');
        setErrorMessage('Camera permission was denied. Visual engagement analytics requires camera access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('unavailable');
        setErrorMessage('No camera device was found on your system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraState('error');
        setErrorMessage('Camera is currently in use by another application.');
      } else {
        setCameraState('error');
        setErrorMessage(err.message || 'Failed to initialize camera access.');
      }
    }
  }, []);

  // Auto-start camera if autoStart is true
  useEffect(() => {
    if (autoStart && cameraState === 'off') {
      startCamera();
    }
  }, [autoStart, cameraState, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Helper Functions: EAR & Head Pose Calculations
  const calculateEar = (landmarks: any[], eyeIndices: [number, number, number, number, number, number]): number => {
    const p1 = landmarks[eyeIndices[0]];
    const p2 = landmarks[eyeIndices[1]];
    const p3 = landmarks[eyeIndices[2]];
    const p4 = landmarks[eyeIndices[3]];
    const p5 = landmarks[eyeIndices[4]];
    const p6 = landmarks[eyeIndices[5]];

    const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
    const v1 = dist(p2, p6);
    const v2 = dist(p3, p5);
    const h = dist(p1, p4);

    if (h === 0) return 0.30;
    return (v1 + v2) / (2.0 * h);
  };

  const calculateHeadPose = (landmarks: any[]) => {
    const nose = landmarks[1];
    const chin = landmarks[152];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];

    const eyeMid = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
      z: (leftEye.z + rightEye.z) / 2
    };

    const mouthMid = {
      x: (leftMouth.x + rightMouth.x) / 2,
      y: (leftMouth.y + rightMouth.y) / 2
    };

    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

    // Yaw: Horizontal turn
    const yawOffset = (nose.x - eyeMid.x) / (eyeDist / 2);
    const yaw = Math.max(-90, Math.min(90, yawOffset * 65.0));

    // Pitch: Vertical tilt
    const faceLength = Math.hypot(chin.x - eyeMid.x, chin.y - eyeMid.y);
    const noseVertOffset = (nose.y - (eyeMid.y + faceLength * 0.4)) / (faceLength / 2);
    const pitch = Math.max(-90, Math.min(90, noseVertOffset * 70.0));

    // Roll: Head tilt angle
    const rollRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const roll = Math.max(-90, Math.min(90, (rollRad * 180) / Math.PI));

    return { pitch, yaw, roll };
  };

  // Local ML Inference Engine (Random Forest Rule Engine matching ml/predict.py)
  // Fine-tuned for realistic head pose, gaze variations, and adaptive EAR thresholds
  const predictEngagementState = (
    faceDetected: boolean,
    pitch: number,
    yaw: number,
    roll: number,
    ear: number,
    gazeOffset: number,
    baselineEar: number = 0.30
  ): { state: string; confidence: number } => {
    if (!faceDetected) {
      return { state: 'Away', confidence: 0.98 };
    }

    // Fine-tuned thresholds:
    // Yaw > 28 deg or Pitch > 25 deg or Gaze Offset > 0.55 indicates Distracted
    const isDistracted = Math.abs(yaw) > 28.0 || Math.abs(pitch) > 25.0 || gazeOffset > 0.55;
    
    // Low Engagement if sustained EAR drops below 60% of baseline EAR (or < 0.18) OR severe downward head slump (Pitch > 25)
    const lowEarThreshold = Math.max(0.16, baselineEar * 0.60);
    const isLowEngagement = ear < lowEarThreshold || (pitch > 25.0 && ear < baselineEar * 0.75);

    if (isDistracted) {
      return { state: 'Distracted', confidence: 0.94 };
    }
    if (isLowEngagement) {
      return { state: 'Low Engagement', confidence: 0.91 };
    }
    return { state: 'Focused', confidence: 0.97 };
  };

  // Flush offline queued events to FastAPI backend when connection is restored
  const flushOfflineQueue = useCallback(async () => {
    if (offlineQueueRef.current.length === 0) return;
    const queueToFlush = [...offlineQueueRef.current];
    offlineQueueRef.current = [];

    for (const item of queueToFlush) {
      try {
        await engagementApi.postEvent(item);
        setBackendStatus('connected');
      } catch (err: any) {
        console.warn("Failed to flush offline event:", err);
        if (err?.response) continue; // rejected by the server: drop it
        // Still offline: re-queue this and everything after it
        offlineQueueRef.current.push(...queueToFlush.slice(queueToFlush.indexOf(item)));
        setBackendStatus('disconnected');
        break;
      }
    }
  }, []);

  // Send aggregated payload to FastAPI backend every 5 seconds
  const processFiveSecondAggregation = useCallback(async (currentMetrics: FrameMetrics) => {
    if (!persistEvents) return;
    const now = Date.now();
    if (now - lastEventSentTimeRef.current < 5000) return;

    lastEventSentTimeRef.current = now;
    const window = rollingWindowRef.current;
    if (window.length === 0) return;

    // Calculate aggregated metrics over the 5-second window
    const avgPitch = window.reduce((acc, m) => acc + m.pitch, 0) / window.length;
    const avgYaw = window.reduce((acc, m) => acc + m.yaw, 0) / window.length;
    const avgRoll = window.reduce((acc, m) => acc + m.roll, 0) / window.length;
    const avgEar = window.reduce((acc, m) => acc + m.ear, 0) / window.length;
    const avgGaze = window.reduce((acc, m) => acc + m.gaze_offset, 0) / window.length;
    const avgConf = window.reduce((acc, m) => acc + m.confidence, 0) / window.length;

    // Determine dominant state in window
    const stateCounts: Record<string, number> = {};
    window.forEach(m => {
      stateCounts[m.state] = (stateCounts[m.state] || 0) + 1;
    });
    let dominantState = 'Focused';
    let maxCount = 0;
    Object.entries(stateCounts).forEach(([st, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantState = st;
      }
    });

    const playback = playbackRef.current;
    const payload = {
      lecture_id: playback.lectureId,
      topic_id: playback.topicId,
      timestamp: new Date().toISOString(),
      timestamp_seconds: Math.floor(playback.videoCurrentTime),
      state: dominantState,
      confidence: Math.round(avgConf * 100) / 100,
      metrics: {
        pitch: Math.round(avgPitch * 10) / 10,
        yaw: Math.round(avgYaw * 10) / 10,
        roll: Math.round(avgRoll * 10) / 10,
        ear: Math.round(avgEar * 1000) / 1000,
        gaze_offset: Math.round(avgGaze * 100) / 100,
        face_detected: currentMetrics.face_detected
      }
    };

    // Attempt backend transmission
    try {
      await engagementApi.postEvent(payload);
      setBackendStatus('connected');
      // Flush any queued offline events if backend is online
      flushOfflineQueue();
    } catch (err: any) {
      // A response from the server (bad lecture/topic, consent withdrawn, signed out) will not
      // succeed on retry, so only network failures are queued.
      if (err?.response) {
        console.warn("[Engagement] Backend rejected engagement payload:", err.response.status, err.response.data?.detail);
        return;
      }
      console.warn("[Backend Disconnected] Queuing engagement payload in memory:", err);
      setBackendStatus('disconnected');
      if (offlineQueueRef.current.length < 50) {
        offlineQueueRef.current.push(payload);
      }
    }
  }, [persistEvents, flushOfflineQueue]);

  // Main Frame Processing Loop (Runs locally in WebAssembly via requestAnimationFrame)
  const processFrame = useCallback(() => {
    const now = Date.now();

    // FPS Counter calculation
    frameCountRef.current += 1;
    if (now - lastFpsCheckRef.current >= 1000) {
      const currentFps = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsCheckRef.current = now;
      setMetrics(prev => ({ ...prev, fps: currentFps }));
    }

    const video = videoRef.current;
    if (video && video.paused && streamRef.current) {
      video.play().catch(e => console.warn("Auto-resume video play:", e));
    }

    if (cameraState !== 'active' || !video || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (landmarkerRef.current) {
      try {
        const results = landmarkerRef.current.detectForVideo(video, now);
        
        // Multi-face check
        if (results.faceLandmarks && results.faceLandmarks.length > 1) {
          setMultiFaceDetected(true);
        } else {
          setMultiFaceDetected(false);
        }

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          lastNoFaceTimeRef.current = null;
          const landmarks = results.faceLandmarks[0];

          // Compute Head Pose
          const { pitch, yaw, roll } = calculateHeadPose(landmarks);

          // Compute Eye Aspect Ratio (EAR)
          const leftEar = calculateEar(landmarks, [33, 160, 158, 133, 153, 144]);
          const rightEar = calculateEar(landmarks, [362, 385, 387, 263, 373, 380]);
          const rawEar = (leftEar + rightEar) / 2.0;

          // Adaptive Baseline Tracking (Collect non-zero EAR history)
          if (rawEar > 0.18) {
            openEarHistoryRef.current.push(rawEar);
            if (openEarHistoryRef.current.length > 60) openEarHistoryRef.current.shift();
            
            // 85th percentile as baseline open-eye EAR
            const sorted = [...openEarHistoryRef.current].sort((a, b) => a - b);
            const p85Idx = Math.floor(sorted.length * 0.85);
            if (sorted[p85Idx]) {
              adaptiveBaselineEarRef.current = sorted[p85Idx];
            }
          }

          // Physiological Blink Suppression Filter (< 350ms EAR drops treated as natural blinks)
          let effectiveEar = rawEar;
          const lowEarCutoff = Math.max(0.16, adaptiveBaselineEarRef.current * 0.60);

          if (rawEar < lowEarCutoff) {
            if (!blinkStartTimeRef.current) {
              blinkStartTimeRef.current = now;
            }
            // If drop duration <= 350ms, override to baseline open EAR (suppress false low engagement during blink)
            if (now - blinkStartTimeRef.current <= 350) {
              effectiveEar = adaptiveBaselineEarRef.current;
            }
          } else {
            blinkStartTimeRef.current = null;
          }

          // Compute Gaze Offset (scaled smoothly)
          const gazeOffset = Math.min(2.0, (Math.abs(yaw) / 50.0) + (Math.abs(pitch) / 50.0));

          // Run fine-tuned ML inference
          const { state, confidence: conf } = predictEngagementState(
            true, pitch, yaw, roll, effectiveEar, gazeOffset, adaptiveBaselineEarRef.current
          );

          const frameData: FrameMetrics = {
            pitch, yaw, roll, ear: effectiveEar, gaze_offset: gazeOffset,
            face_detected: true, state, confidence: conf, timestamp: now
          };

          // Temporal smoothing: Keep last 15 frames (~1-2 seconds)
          rollingWindowRef.current.push(frameData);
          if (rollingWindowRef.current.length > 15) {
            rollingWindowRef.current.shift();
          }

          setCurrentState(state);
          setConfidence(Math.round(conf * 100));
          setMetrics(prev => ({
            ...prev,
            pitch: Math.round(pitch * 10) / 10,
            yaw: Math.round(yaw * 10) / 10,
            roll: Math.round(roll * 10) / 10,
            ear: Math.round(effectiveEar * 1000) / 1000,
            gaze_offset: Math.round(gazeOffset * 100) / 100,
            face_detected: true
          }));

          // Render live facial tracking mesh overlay on canvas
          if (canvasRef.current && video.videoWidth > 0) {
            const canvas = canvasRef.current;
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const color = state === 'Focused' ? 'rgba(16, 185, 129, 0.8)' : state === 'Distracted' ? 'rgba(245, 158, 11, 0.8)' : 'rgba(244, 63, 94, 0.8)';
              ctx.fillStyle = color;
              
              // Draw landmark mesh dots across face
              for (let i = 0; i < landmarks.length; i += 3) {
                const pt = landmarks[i];
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.3, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }

          if (onStateUpdate) {
            onStateUpdate(state, Math.round(conf * 100), frameData);
          }

          // Trigger 5-second aggregation
          processFiveSecondAggregation(frameData);
        } else {
          // Clear landmark canvas when face is absent
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          // No face detected handling with Grace Period (2000 ms before declaring "Away")
          if (!lastNoFaceTimeRef.current) {
            lastNoFaceTimeRef.current = now;
          }

          const durationNoFace = now - lastNoFaceTimeRef.current;
          let state = currentState;
          let conf = 0.85;

          if (durationNoFace >= 2000) {
            state = 'Away';
            conf = 0.98;
          }

          const frameData: FrameMetrics = {
            pitch: 0, yaw: 0, roll: 0, ear: 0, gaze_offset: 1.0,
            face_detected: false, state, confidence: conf, timestamp: now
          };

          rollingWindowRef.current.push(frameData);
          if (rollingWindowRef.current.length > 15) {
            rollingWindowRef.current.shift();
          }

          setCurrentState(state);
          setConfidence(Math.round(conf * 100));
          setMetrics(prev => ({ ...prev, face_detected: false }));

          if (onStateUpdate) {
            onStateUpdate(state, Math.round(conf * 100), frameData);
          }

          processFiveSecondAggregation(frameData);
        }
      } catch (err) {
        console.warn("Frame detection loop exception:", err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [cameraState, onStateUpdate, processFiveSecondAggregation]);

  useEffect(() => {
    let isCancelled = false;
    const animate = () => {
      if (!isCancelled) {
        processFrame();
      }
    };
    if (cameraState === 'active' && isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      isCancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraState, isPlaying, processFrame]);

  // Ensure camera stream is attached to video DOM element whenever videoRef is mounted
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn("Video attach play exception:", e));
    }
  });

  // Color mappings
  const getStateBadgeStyle = (state: string) => {
    switch (state) {
      case 'Focused':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'Distracted':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Low Engagement':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'Away':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    }
  };

  return (
    <div className={`glass-card rounded-2xl border border-dark-border p-4 space-y-4 ${compact ? 'max-w-xs' : 'w-full'}`}>
      {/* Header & Status Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-brand-400" />
          <h3 className="text-sm font-bold text-white font-heading">LIVE CAMERA & CV ANALYTICS</h3>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          {cameraState === 'active' && (
            <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Camera Active</span>
            </span>
          )}
          {backendStatus === 'connected' ? (
            <span className="flex items-center space-x-1 text-slate-400 text-[11px]" title="Backend Sync Online">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-amber-400 text-[11px]" title="Backend Disconnected - Events Queued in RAM">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </span>
          )}
        </div>
      </div>

      {/* Multi-Face Warning Banner */}
      {multiFaceDetected && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2">
          <Users className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Multiple faces detected. Please ensure only the enrolled learner is visible for engagement analytics.</span>
        </div>
      )}

      {/* Camera Preview Box */}
      <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)' }}
          className={`w-full h-full object-cover ${cameraState === 'active' || cameraState === 'starting' ? 'block' : 'hidden'}`}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* States when Camera is Off or Error */}
        {cameraState === 'off' && (
          <div className="text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <CameraOff className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300 font-medium">Camera is currently stopped.</p>
            <button
              onClick={startCamera}
              className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg flex items-center space-x-2 mx-auto"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          </div>
        )}

        {cameraState === 'starting' && (
          <div className="text-center p-6 space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">Requesting camera access & initializing WebAssembly model...</p>
          </div>
        )}

        {(cameraState === 'permission_denied' || cameraState === 'error' || cameraState === 'unavailable') && (
          <div className="text-center p-5 space-y-3 max-w-sm">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-xs text-slate-200">{errorMessage}</div>
            <p className="text-[11px] text-slate-400">Your video is processed locally in RAM and never stored or uploaded.</p>
            <div className="flex justify-center space-x-2">
              <button
                onClick={startCamera}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Overlay Metrics Badge on Video */}
        {cameraState === 'active' && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
            <div className={`px-2.5 py-1 rounded-lg border backdrop-blur-md text-xs font-semibold flex items-center space-x-1.5 ${getStateBadgeStyle(currentState)}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
              <span>{currentState.toUpperCase()} ({confidence}%)</span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-slate-300 font-mono">
              FPS: {metrics.fps}
            </div>
          </div>
        )}
      </div>

      {/* Signal Dashboard Panel */}
      {cameraState === 'active' && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div className="p-2 rounded-xl bg-dark-bg/60 border border-dark-border">
            <div className="text-[10px] text-slate-400 uppercase font-sans">Head Pose</div>
            <div className="text-white font-bold mt-0.5">P:{metrics.pitch}° Y:{metrics.yaw}°</div>
          </div>
          <div className="p-2 rounded-xl bg-dark-bg/60 border border-dark-border">
            <div className="text-[10px] text-slate-400 uppercase font-sans">Eye Aspect Ratio</div>
            <div className="text-white font-bold mt-0.5">EAR: {metrics.ear}</div>
          </div>
          <div className="p-2 rounded-xl bg-dark-bg/60 border border-dark-border">
            <div className="text-[10px] text-slate-400 uppercase font-sans">Gaze Offset</div>
            <div className="text-white font-bold mt-0.5">{metrics.gaze_offset}</div>
          </div>
        </div>
      )}

      {/* Privacy Guarantee Indicator */}
      <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center space-x-2">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>🔒 Privacy Protected:</strong> Camera processing is performed locally in browser memory. No video or raw frames are recorded or stored.
        </span>
      </div>

      {/* Controls: Stop Camera */}
      {showControls && cameraState === 'active' && (
        <div className="flex justify-end">
          <button
            onClick={stopCamera}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <CameraOff className="w-3.5 h-3.5" />
            <span>Stop Camera</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveCamera;
