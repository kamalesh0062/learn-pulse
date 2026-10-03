import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, RotateCcw, HelpCircle, CameraOff } from 'lucide-react';
import { engagementApi } from '../../services/api';
import { Topic } from '../../types';
import { LiveCamera } from './LiveCamera';

interface VideoPlayerProps {
  lectureId: number;
  videoUrl: string;
  topics: Topic[];
  /** Log play/pause/seek/replay events for the signed-in user (students only). */
  recordActivity: boolean;
  /** Run the webcam engagement tracker (students who granted camera consent). */
  trackEngagement: boolean;
  /** Why the camera panel is not shown, when trackEngagement is false. */
  cameraDisabledReason?: 'no_consent' | 'not_student';
  onQuizTrigger?: (topicId: number) => void;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export const InteractiveVideoPlayer: React.FC<VideoPlayerProps> = ({
  lectureId,
  videoUrl,
  topics,
  recordActivity,
  trackEngagement,
  cameraDisabledReason,
  onQuizTrigger,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Real-time CV Engagement state from LiveCamera (null until the camera reports)
  const [liveFocusState, setLiveFocusState] = useState<string | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number>(0);

  // Active topic based on current playback timestamp; none if the position is outside every topic
  const activeTopic = topics.find(t => currentTime >= t.start_time && currentTime <= t.end_time);

  const logEvent = (eventType: string, position: number) => {
    if (!recordActivity) return;
    engagementApi.logVideoEvent(lectureId, eventType, position).catch((err) => {
      console.warn(`Failed to record ${eventType} video event:`, err);
    });
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((err) => console.warn("Video play failed:", err));
    } else {
      video.pause();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const seekTo = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    // Going back to something already watched is a replay; anything else is a plain seek
    logEvent(newTime < video.currentTime - 2 ? 'REPLAY' : 'SEEK', newTime);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const jumpToTopic = (startTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(startTime);
    if (video.paused) {
      video.play().catch((err) => console.warn("Video play failed:", err));
    }
  };

  const getFocusBadgeColor = (state: string) => {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Video Player & Topic Timeline */}
      <div className="lg:col-span-2 space-y-4">
        {/* Video Container */}
        <div className="relative rounded-2xl overflow-hidden glass-card border border-dark-border bg-black group shadow-2xl">
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onPlay={(e) => {
              setIsPlaying(true);
              logEvent('PLAY', e.currentTarget.currentTime);
            }}
            onPause={(e) => {
              setIsPlaying(false);
              // The browser also fires pause right before ended; that is not a student pause
              if (!e.currentTarget.ended) logEvent('PAUSE', e.currentTarget.currentTime);
            }}
            onEnded={(e) => {
              setIsPlaying(false);
              logEvent('COMPLETE', e.currentTarget.currentTime);
            }}
            onError={() => setVideoError(true)}
            onClick={togglePlay}
            className="w-full aspect-video object-cover cursor-pointer"
          />

          {videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center p-6">
              <p className="text-xs text-rose-300">
                This lecture's video could not be loaded from<br />
                <span className="font-mono break-all text-slate-400">{videoUrl}</span>
              </p>
            </div>
          )}

          {/* Live Engagement Badge */}
          <div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
            {trackEngagement && liveFocusState && (
              <div className={`px-3 py-1.5 rounded-xl border backdrop-blur-md font-semibold text-xs flex items-center space-x-2 ${getFocusBadgeColor(liveFocusState)}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
                <span>Engagement: {liveFocusState.toUpperCase()} ({liveConfidence}%)</span>
              </div>
            )}
            {activeTopic && (
              <div className="px-2.5 py-1.5 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md text-[10px] text-brand-300 font-mono hidden sm:block">
                Topic: {activeTopic.title}
              </div>
            )}
          </div>

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-95 group-hover:opacity-100 transition-opacity">
            {/* Progress Bar */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="1"
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              disabled={!duration}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 mb-3"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center transition-transform hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <button
                  onClick={() => jumpToTopic(0)}
                  className="text-slate-300 hover:text-white p-2"
                  title="Restart Lecture"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="text-xs font-mono text-slate-300">
                  {formatTime(currentTime)} / {duration ? formatTime(duration) : '--:--'}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {onQuizTrigger && activeTopic && (
                  <button
                    onClick={() => onQuizTrigger(activeTopic.id)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold hover:bg-purple-600/50 flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Topic Quiz
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Topic Timeline */}
        <div className="glass-card rounded-xl p-4 border border-dark-border">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">
            Lecture Topic Timeline & Markers
          </h4>
          {topics.length === 0 ? (
            <p className="text-xs text-slate-400">No topics have been defined for this lecture yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topics.map((t) => {
                const isActive = activeTopic?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => jumpToTopic(t.start_time)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-600/20 border-brand-500 text-white shadow-glow'
                        : 'bg-dark-bg/60 border-dark-border text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs font-bold">{t.title}</div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-card text-brand-400 border border-dark-border shrink-0">
                        {formatTime(t.start_time)} - {formatTime(t.end_time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: LiveCamera Component */}
      <div className="lg:col-span-1">
        {trackEngagement ? (
          <LiveCamera
            lectureId={lectureId}
            topicId={activeTopic?.id}
            videoCurrentTime={currentTime}
            isPlaying={isPlaying}
            onStateUpdate={(state, conf) => {
              setLiveFocusState(state);
              setLiveConfidence(conf);
            }}
          />
        ) : (
          <div className="glass-card rounded-2xl border border-dark-border p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <CameraOff className="w-6 h-6" />
            </div>
            {cameraDisabledReason === 'no_consent' ? (
              <>
                <h3 className="text-sm font-bold text-white">Camera analytics is off</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You have not enabled camera-based engagement analytics, so your webcam is not used.
                  Quizzes and video activity still count towards your topic difficulty scores.
                </p>
                <Link to="/privacy" className="inline-block gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl">
                  Review Privacy Controls
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-white">Preview mode</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Engagement tracking and video activity are only recorded for student accounts.
                  Nothing you do on this page is added to the analytics.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
