import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Gauge,
  Navigation,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Repeat
} from 'lucide-react';
import confetti from 'canvas-confetti';

const TRAIN_PALETTES = {
  Express: {
    primary: '#ef4444',
    secondary: '#b91c1c',
    glow: '#f87171',
    light: '#fee2e2',
    name: 'Express InterCity',
    speedLabel: '200 km/h'
  },
  Local: {
    primary: '#10b981',
    secondary: '#047857',
    glow: '#34d399',
    light: '#d1fae5',
    name: 'Local Commuter',
    speedLabel: '90 km/h'
  },
  Freight: {
    primary: '#f59e0b',
    secondary: '#b45309',
    glow: '#fbbf24',
    light: '#fef3c7',
    name: 'Heavy Freight Cargo',
    speedLabel: '75 km/h'
  },
  HighSpeed: {
    primary: '#a855f7',
    secondary: '#7e22ce',
    glow: '#c084fc',
    light: '#f3e8ff',
    name: 'Shinkansen Bullet',
    speedLabel: '320 km/h'
  }
};

// Web Audio sound synthesizer for realistic train bell & station arrival chime
class RailwayAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playStationChime() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // Soft 2-tone melodic railway chime (e.g., E5 -> G#5)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, t); // E5
      gain1.gain.setValueAtTime(0.08, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.6);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(830.61, t + 0.18); // G#5
      gain2.gain.setValueAtTime(0.08, t + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.18);
      osc2.stop(t + 0.9);
    } catch {
      // Audio context policy safe ignore
    }
  }

  playArrivalFanfare() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // Triumphant 3-chord arrival chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = t + idx * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.8);
      });
    } catch {
      // Audio context policy safe ignore
    }
  }
}

const audioSynth = new RailwayAudio();

export default function RailwayGraph({
  network,
  activeRoute = [],
  failureStation = null,
  deadEndStations = [],
  shortestPath = [],
  selectedStation = null,
  trainType = 'Express',
  shortestPathResult = null,
  verificationResult = null,
  onSelectStation = () => {},
  onStationDrag = () => {}
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState(null);

  // Train Animation States
  const [activePathMode, setActivePathMode] = useState('shortest'); // 'shortest' | 'route'
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.5 | 1 | 2
  const [isLooping, setIsLooping] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // default muted for comfortable browser experience
  const [currentStationIndex, setCurrentStationIndex] = useState(0);

  const svgRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const lastAnnouncedStationRef = useRef(-1);

  const edges = network?.transitions || [];
  const stations = network?.stations || [];
  const startStation = network?.start_station;
  const acceptingStations = useMemo(() => new Set(network?.accepting_stations || []), [network]);

  // Compute station coordinates (use metadata coordinates or circular layout as fallback)
  const nodePositions = useMemo(() => {
    const positions = {};
    const total = stations.length || 1;
    const centerX = 420;
    const centerY = 280;
    const radius = Math.min(centerX, centerY) - 80;

    stations.forEach((st, idx) => {
      const meta = network?.station_metadata?.[st];
      if (meta?.x !== undefined && meta?.y !== undefined) {
        positions[st] = { x: meta.x, y: meta.y };
      } else {
        const angle = (idx / total) * 2 * Math.PI;
        positions[st] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      }
    });
    return positions;
  }, [network, stations]);

  // Group edges between same pair
  const edgeGroups = useMemo(() => {
    const groups = {};
    edges.forEach((e) => {
      const key = `${e.source}-->${e.target}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e.train_type);
    });
    return groups;
  }, [edges]);

  // Determine current active train path
  const currentPath = useMemo(() => {
    if (activePathMode === 'shortest' && shortestPath && shortestPath.length >= 2) {
      return shortestPath;
    }
    if (activePathMode === 'route' && activeRoute && activeRoute.length >= 2) {
      return activeRoute;
    }
    // Fallback: if shortestPath exists use it, else if activeRoute exists use it
    if (shortestPath && shortestPath.length >= 2) return shortestPath;
    if (activeRoute && activeRoute.length >= 2) return activeRoute;
    return [];
  }, [activePathMode, shortestPath, activeRoute]);

  // Auto-switch mode or restart train when shortestPath changes
  useEffect(() => {
    if (shortestPath && shortestPath.length >= 2) {
      setActivePathMode('shortest');
      setProgress(0);
      setIsPlaying(true);
      lastAnnouncedStationRef.current = -1;
    }
  }, [shortestPath]);

  useEffect(() => {
    if (activeRoute && activeRoute.length >= 2 && (!shortestPath || shortestPath.length < 2)) {
      setActivePathMode('route');
      setProgress(0);
      setIsPlaying(true);
      lastAnnouncedStationRef.current = -1;
    }
  }, [activeRoute]);

  // Audio mute sync
  useEffect(() => {
    audioSynth.muted = isMuted;
  }, [isMuted]);

  // Compute total polyline distance and segment waypoints for the current train path
  const pathGeometry = useMemo(() => {
    if (!currentPath || currentPath.length < 2) return null;
    const waypoints = [];
    for (const st of currentPath) {
      const pos = nodePositions[st];
      if (pos) {
        waypoints.push({ ...pos, name: st });
      }
    }
    if (waypoints.length < 2) return null;

    const segments = [];
    let totalDist = 0;
    const cumDists = [0];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      segments.push({
        p1,
        p2,
        dx,
        dy,
        len,
        angle,
        startDist: totalDist,
        endDist: totalDist + len
      });

      totalDist += len;
      cumDists.push(totalDist);
    }

    return { waypoints, segments, totalDist, cumDists };
  }, [currentPath, nodePositions]);

  // Interpolate train coordinate and angle at a given distance along the path
  const getTrainAtDistance = useCallback((dist, geom) => {
    if (!geom || geom.segments.length === 0) return null;
    const clampedDist = Math.max(0, Math.min(dist, geom.totalDist));

    // Find active segment
    let segIndex = 0;
    for (let i = 0; i < geom.segments.length; i++) {
      if (clampedDist <= geom.segments[i].endDist || i === geom.segments.length - 1) {
        segIndex = i;
        break;
      }
    }

    const seg = geom.segments[segIndex];
    const segT = seg.len > 0 ? (clampedDist - seg.startDist) / seg.len : 0;
    const x = seg.p1.x + seg.dx * segT;
    const y = seg.p1.y + seg.dy * segT;

    return {
      x,
      y,
      angle: seg.angle,
      segIndex,
      segT,
      currentStation: seg.p1.name,
      nextStation: seg.p2.name
    };
  }, []);

  // Train Animation Loop
  useEffect(() => {
    if (!isPlaying || !pathGeometry) {
      lastTimeRef.current = null;
      return;
    }

    const baseDuration = Math.max(3000, pathGeometry.totalDist * 8); // ms for entire route

    const animate = (time) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const increment = (delta / baseDuration) * speedMultiplier;

      setProgress((prev) => {
        let next = prev + increment;
        if (next >= 1) {
          // Reached destination!
          if (lastAnnouncedStationRef.current !== pathGeometry.waypoints.length - 1) {
            lastAnnouncedStationRef.current = pathGeometry.waypoints.length - 1;
            audioSynth.playArrivalFanfare();
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 }
            });
          }

          if (isLooping) {
            lastAnnouncedStationRef.current = -1;
            return 0; // restart
          } else {
            setIsPlaying(false);
            return 1;
          }
        }

        // Trigger station chime when passing an intermediate station
        const currentDist = next * pathGeometry.totalDist;
        for (let i = 1; i < pathGeometry.cumDists.length - 1; i++) {
          const stDist = pathGeometry.cumDists[i];
          if (Math.abs(currentDist - stDist) < 12 && lastAnnouncedStationRef.current !== i) {
            lastAnnouncedStationRef.current = i;
            audioSynth.playStationChime();
            break;
          }
        }

        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, pathGeometry, speedMultiplier, isLooping]);

  // Current train positions (Engine and Trailing Car)
  const trainState = useMemo(() => {
    if (!pathGeometry) return null;
    const currentDist = progress * pathGeometry.totalDist;
    const head = getTrainAtDistance(currentDist, pathGeometry);
    // Trailing passenger car positioned 36px behind along track
    const car = getTrainAtDistance(Math.max(0, currentDist - 36), pathGeometry);
    return { head, car, currentDist };
  }, [pathGeometry, progress, getTrainAtDistance]);

  // Active service palette
  const activePalette = TRAIN_PALETTES[trainType] || TRAIN_PALETTES.Express;

  // Track helpers
  const isEdgeInRoute = (src, dest) => {
    if (!activeRoute || activeRoute.length < 2) return false;
    for (let i = 0; i < activeRoute.length - 1; i++) {
      if (activeRoute[i] === src && activeRoute[i + 1] === dest) return true;
    }
    return false;
  };

  const isEdgeInShortest = (src, dest) => {
    if (!shortestPath || shortestPath.length < 2) return false;
    for (let i = 0; i < shortestPath.length - 1; i++) {
      if (shortestPath[i] === src && shortestPath[i + 1] === dest) return true;
    }
    return false;
  };

  // Mouse interaction handlers for Canvas
  const handleMouseDownNode = (e, station) => {
    e.stopPropagation();
    setDraggingNode(station);
    onSelectStation(station);
  };

  const handleMouseDownSvg = (e) => {
    if (e.button === 0) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (draggingNode) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;
      onStationDrag(draggingNode, Math.round(rawX), Math.round(rawY));
    } else if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '600px',
        overflow: 'hidden',
        borderRadius: '16px',
        background: 'radial-gradient(ellipse at 50% 40%, #0d1527 0%, #060913 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.7)'
      }}
    >
      {/* Top Floating Train Telemetry & Dispatcher Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 76,
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
        }}
      >
        {/* Left: Active Service & Path Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${activePalette.secondary}, ${activePalette.primary})`,
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: '700',
              boxShadow: `0 2px 8px ${activePalette.primary}44`
            }}
          >
            <span>🚆</span>
            <span>{activePalette.name}</span>
          </div>

          {currentPath.length >= 2 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
              <span style={{ color: '#94a3b8' }}>
                {activePathMode === 'shortest' ? 'BFS Shortest Path:' : 'Active Journey:'}
              </span>
              <strong style={{ color: '#38bdf8' }}>{currentPath[0]}</strong>
              <ArrowRight size={12} color="#64748b" />
              <strong style={{ color: '#34d399' }}>{currentPath[currentPath.length - 1]}</strong>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  fontWeight: '600'
                }}
              >
                {currentPath.length - 1} Hops
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Select an Origin & Destination in BFS to dispatch train
            </span>
          )}
        </div>

        {/* Center/Right: Interactive Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Path Mode Selector if both are available */}
          {shortestPath.length >= 2 && activeRoute.length >= 2 && (
            <div
              style={{
                display: 'flex',
                background: 'rgba(0,0,0,0.3)',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setActivePathMode('shortest');
                  setProgress(0);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  background: activePathMode === 'shortest' ? '#10b981' : 'transparent',
                  color: activePathMode === 'shortest' ? '#ffffff' : '#94a3b8'
                }}
              >
                BFS Shortest
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setActivePathMode('route');
                  setProgress(0);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  background: activePathMode === 'route' ? '#0284c7' : 'transparent',
                  color: activePathMode === 'route' ? '#ffffff' : '#94a3b8'
                }}
              >
                Custom Journey
              </button>
            </div>
          )}

          {/* Play/Pause */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!pathGeometry}
            title={isPlaying ? 'Pause Train' : 'Start Train'}
            style={{ width: 28, height: 28, padding: 0 }}
          >
            {isPlaying ? <Pause size={14} color="#38bdf8" /> : <Play size={14} color="#34d399" />}
          </button>

          {/* Replay */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setProgress(0);
              setIsPlaying(true);
              lastAnnouncedStationRef.current = -1;
            }}
            disabled={!pathGeometry}
            title="Replay from Origin"
            style={{ width: 28, height: 28, padding: 0 }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setSpeedMultiplier((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1));
            }}
            title="Toggle Speed (0.5x, 1x, 2x)"
            style={{ fontSize: '0.7rem', fontWeight: '700', padding: '3px 7px', minWidth: '38px' }}
          >
            {speedMultiplier}x
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setIsLooping((l) => !l)}
            title={isLooping ? 'Continuous loop: ON' : 'Continuous loop: OFF'}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: isLooping ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              borderColor: isLooping ? '#38bdf8' : 'rgba(255,255,255,0.1)'
            }}
          >
            <Repeat size={13} color={isLooping ? '#38bdf8' : '#94a3b8'} />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? 'Unmute Station Chimes' : 'Mute Audio'}
            style={{ width: 28, height: 28, padding: 0 }}
          >
            {isMuted ? <VolumeX size={14} color="#94a3b8" /> : <Volume2 size={14} color="#34d399" />}
          </button>
        </div>
      </div>

      {/* Canvas View Controls (Zoom In/Out, Reset) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          title="Zoom In"
          style={{ width: 30, height: 30, padding: 0 }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
          title="Zoom Out"
          style={{ width: 30, height: 30, padding: 0 }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset View"
          style={{ width: 30, height: 30, padding: 0 }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Progress Bar along bottom of header bar */}
      {pathGeometry && (
        <div
          style={{
            position: 'absolute',
            top: 62,
            left: 20,
            right: 20,
            zIndex: 14,
            height: '3px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: `linear-gradient(90deg, #38bdf8, ${activePalette.primary})`,
              boxShadow: `0 0 8px ${activePalette.primary}`,
              transition: 'width 0.05s linear'
            }}
          />
        </div>
      )}

      {/* Legend & HUD bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.88)',
          padding: '8px 14px',
          borderRadius: '10px',
          fontSize: '0.74rem',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '4px',
              background: '#1d4ed8',
              border: '2px solid #60a5fa'
            }}
          />
          <span>Depot (q₀)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#065f46',
              border: '2px double #34d399'
            }}
          />
          <span>Terminus (F)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '3px',
              background: '#881337',
              border: '1px solid #fb7185'
            }}
          />
          <span>Buffer Stop (Dead End)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>═══</span>
          <span>Electrified Shortest Track</span>
        </div>
        {trainState?.head && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#38bdf8',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <span>📍 En Route:</span>
            <strong>
              {trainState.head.currentStation} ➔ {trainState.head.nextStation}
            </strong>
            <span>({Math.round(progress * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Main Interactive Railway SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDownSvg}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          {/* Subtle Railway Grid Pattern */}
          <pattern id="rail-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
          </pattern>

          {/* Glow Filters */}
          <filter id="glow-track" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="glow-headlight" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Locomotive Body Gradient */}
          <linearGradient id="train-loco-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={activePalette.secondary} />
            <stop offset="60%" stopColor={activePalette.primary} />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Coach Body Gradient */}
          <linearGradient id="train-coach-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={activePalette.secondary} />
            <stop offset="80%" stopColor={activePalette.primary} />
            <stop offset="100%" stopColor={activePalette.secondary} />
          </linearGradient>

          {/* High-intensity forward beam from train headlights */}
          <linearGradient id="headlight-beam-cone" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="25%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="75%" stopColor="#0284c7" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </linearGradient>

          {/* Directional Chevron Markers for Tracks */}
          <marker
            id="track-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 1 1.5 L 7 5 L 1 8.5 z" fill="#64748b" />
          </marker>

          <marker
            id="track-arrow-active"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 1.5 L 7 5 L 1 8.5 z" fill="#06b6d4" />
          </marker>

          <marker
            id="track-arrow-shortest"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 1 1.5 L 7 5 L 1 8.5 z" fill="#10b981" />
          </marker>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#rail-grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* ========================================================= */}
          {/* 1. RENDER RAILWAY TRACKS (Ballast Bed + Sleepers + Rails) */}
          {/* ========================================================= */}
          {Object.entries(edgeGroups).map(([key, types]) => {
            const [src, target] = key.split('-->');
            const p1 = nodePositions[src];
            const p2 = nodePositions[target];
            if (!p1 || !p2) return null;

            const isRouteEdge = isEdgeInRoute(src, target);
            const isShortestEdge = isEdgeInShortest(src, target);

            // Compute geometric vector and normals for parallel steel rails
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len < 1) return null;

            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;

            // Trim ends so tracks connect at platform border rather than center
            const nodeRadius = 26;
            const xStart = p1.x + ux * nodeRadius;
            const yStart = p1.y + uy * nodeRadius;
            const xEnd = p2.x - ux * nodeRadius;
            const yEnd = p2.y - uy * nodeRadius;

            // Steel Rail offset (4.2px on either side of track center)
            const railOffset = 4.2;
            const r1xStart = xStart + nx * railOffset;
            const r1yStart = yStart + ny * railOffset;
            const r1xEnd = xEnd + nx * railOffset;
            const r1yEnd = yEnd + ny * railOffset;

            const r2xStart = xStart - nx * railOffset;
            const r2yStart = yStart - ny * railOffset;
            const r2xEnd = xEnd - nx * railOffset;
            const r2yEnd = yEnd - ny * railOffset;

            // Midpoint for badge and signal
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Styling based on active route state
            let ballastColor = '#131c2e';
            let sleeperColor = '#334155';
            let railColor = '#64748b';
            let railWidth = 1.6;
            let arrowMarker = 'url(#track-arrow)';

            if (isShortestEdge) {
              ballastColor = '#064e3b';
              sleeperColor = '#10b981';
              railColor = '#34d399';
              railWidth = 2.2;
              arrowMarker = 'url(#track-arrow-shortest)';
            } else if (isRouteEdge) {
              ballastColor = '#0c4a6e';
              sleeperColor = '#06b6d4';
              railColor = '#38bdf8';
              railWidth = 2.2;
              arrowMarker = 'url(#track-arrow-active)';
            }

            return (
              <g key={key} className={isShortestEdge ? 'active-railway-shortest' : isRouteEdge ? 'active-railway-journey' : ''}>
                {/* Layer A: Ballast Gravel Bed */}
                <line
                  x1={xStart}
                  y1={yStart}
                  x2={xEnd}
                  y2={yEnd}
                  stroke={ballastColor}
                  strokeWidth="15"
                  strokeLinecap="round"
                  opacity={isShortestEdge || isRouteEdge ? 0.95 : 0.65}
                />

                {/* Layer B: Railway Sleepers / Ties (Crossbars) */}
                <line
                  x1={xStart}
                  y1={yStart}
                  x2={xEnd}
                  y2={yEnd}
                  stroke={sleeperColor}
                  strokeWidth="11"
                  strokeDasharray="2.5 7"
                  strokeLinecap="butt"
                  filter={isShortestEdge || isRouteEdge ? 'url(#glow-track)' : undefined}
                />

                {/* Layer C: Parallel Dual Steel Rails */}
                {/* Left Rail */}
                <line
                  x1={r1xStart}
                  y1={r1yStart}
                  x2={r1xEnd}
                  y2={r1yEnd}
                  stroke={railColor}
                  strokeWidth={railWidth}
                  strokeLinecap="round"
                />
                {/* Right Rail */}
                <line
                  x1={r2xStart}
                  y1={r2yStart}
                  x2={r2xEnd}
                  y2={r2yEnd}
                  stroke={railColor}
                  strokeWidth={railWidth}
                  strokeLinecap="round"
                />

                {/* Layer D: Animated Electric Current Pulse for Shortest / Verified Route */}
                {(isShortestEdge || isRouteEdge) && (
                  <line
                    x1={xStart}
                    y1={yStart}
                    x2={xEnd}
                    y2={yEnd}
                    stroke={isShortestEdge ? '#6ee7b7' : '#7dd3fc'}
                    strokeWidth="2.5"
                    strokeDasharray="8 24"
                    className="flowing-track"
                    opacity="0.9"
                  />
                )}

                {/* Layer E: Directional Chevrons along track */}
                <line
                  x1={xStart + ux * (len * 0.45)}
                  y1={yStart + uy * (len * 0.45)}
                  x2={xStart + ux * (len * 0.58)}
                  y2={yStart + uy * (len * 0.58)}
                  stroke="transparent"
                  markerEnd={arrowMarker}
                />

                {/* Layer F: Track Service Allowance Plate */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-26"
                    y="-10"
                    width="52"
                    height="20"
                    rx="5"
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke={isShortestEdge ? '#10b981' : isRouteEdge ? '#06b6d4' : '#334155'}
                    strokeWidth="1.2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                  />
                  {/* Small colored indicator dots for each train type */}
                  <g transform="translate(-16, 0)">
                    {types.slice(0, 4).map((t, idx) => {
                      const color = TRAIN_PALETTES[t]?.primary || '#94a3b8';
                      return (
                        <circle
                          key={idx}
                          cx={idx * 8 + 4}
                          cy="0"
                          r="2.8"
                          fill={color}
                        />
                      );
                    })}
                  </g>
                  <text
                    x="15"
                    y="3.5"
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="8px"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    {types.length}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ========================================================= */}
          {/* 2. RENDER ANIMATED TRAIN (Locomotive + Passenger Carriage) */}
          {/* ========================================================= */}
          {trainState?.head && (
            <g id="animated-train-group">
              {/* --- 2A: Trailing Passenger Carriage --- */}
              {trainState.car && (
                <g
                  transform={`translate(${trainState.car.x}, ${trainState.car.y}) rotate(${trainState.car.angle})`}
                >
                  {/* Coupler link */}
                  <line x1="16" y1="0" x2="24" y2="0" stroke="#94a3b8" strokeWidth="3" />

                  {/* Carriage Chassis */}
                  <rect
                    x="-18"
                    y="-8"
                    width="36"
                    height="16"
                    rx="3"
                    fill="url(#train-coach-grad)"
                    stroke="#ffffff"
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.6))"
                  />
                  {/* Roof AC Unit */}
                  <rect x="-12" y="-2" width="24" height="4" rx="1" fill="#475569" />

                  {/* Warm Passenger Windows (Top & Bottom rows) */}
                  <rect x="-14" y="-6.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />
                  <rect x="-5" y="-6.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />
                  <rect x="4" y="-6.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />

                  <rect x="-14" y="3.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />
                  <rect x="-5" y="3.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />
                  <rect x="4" y="3.5" width="6" height="3" rx="0.8" fill="#fef08a" opacity="0.9" />

                  {/* Red Rear Marker Tail Lights */}
                  <circle cx="-18" cy="-5" r="1.5" fill="#ef4444" filter="url(#glow-headlight)" />
                  <circle cx="-18" cy="5" r="1.5" fill="#ef4444" filter="url(#glow-headlight)" />
                </g>
              )}

              {/* --- 2B: Lead Locomotive Engine --- */}
              <g
                transform={`translate(${trainState.head.x}, ${trainState.head.y}) rotate(${trainState.head.angle})`}
              >
                {/* High-intensity Headlight Cone Illuminating Track Ahead */}
                <polygon
                  points="22,-3 95,-32 95,32 22,3"
                  fill="url(#headlight-beam-cone)"
                  opacity="0.85"
                />

                {/* Aerodynamic High-Speed Bullet Train Body */}
                <path
                  d="M -20,-8.5 L 8,-8.5 Q 24,-8.5 26,0 Q 24,8.5 8,8.5 L -20,8.5 Z"
                  fill="url(#train-loco-grad)"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  filter="drop-shadow(0 4px 8px rgba(0,0,0,0.65))"
                />

                {/* Speed Stripe Accent */}
                <path
                  d="M -16,-3 L 14,-3 Q 19,-3 21,0 Q 19,3 14,3 L -16,3 Z"
                  fill="#ffffff"
                  opacity="0.4"
                />

                {/* Driver Cockpit Windshield */}
                <path
                  d="M 6,-6 L 16,-6 Q 22,-6 23,0 Q 22,6 16,6 L 6,6 Z"
                  fill="#090d16"
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                />
                <path
                  d="M 8,-4.5 L 14,-4.5 Q 18,-4.5 19,0 Q 18,4.5 14,4.5 L 8,4.5 Z"
                  fill="#38bdf8"
                  opacity="0.85"
                />

                {/* Passenger / Equipment Windows */}
                <rect x="-16" y="-7" width="7" height="3" rx="0.6" fill="#fef08a" opacity="0.9" />
                <rect x="-6" y="-7" width="7" height="3" rx="0.6" fill="#fef08a" opacity="0.9" />
                <rect x="-16" y="4" width="7" height="3" rx="0.6" fill="#fef08a" opacity="0.9" />
                <rect x="-6" y="4" width="7" height="3" rx="0.6" fill="#fef08a" opacity="0.9" />

                {/* Electric Roof Pantograph */}
                <line x1="-10" y1="0" x2="-2" y2="0" stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="-6" cy="0" r="1.5" fill="#f59e0b" />

                {/* Dual Front Halogen/LED Headlight Bulbs */}
                <circle cx="24" cy="-2.5" r="2.2" fill="#ffffff" filter="url(#glow-headlight)" />
                <circle cx="24" cy="2.5" r="2.2" fill="#ffffff" filter="url(#glow-headlight)" />
              </g>
            </g>
          )}

          {/* ========================================================= */}
          {/* 3. RENDER RAILWAY STATIONS & PLATFORMS                    */}
          {/* ========================================================= */}
          {stations.map((st) => {
            const pos = nodePositions[st];
            if (!pos) return null;

            const isStart = st === startStation;
            const isAccepting = acceptingStations.has(st);
            const isDeadEnd = deadEndStations.includes(st);
            const isFailure = st === failureStation;
            const isSelected = st === selectedStation;
            const isInRoute = activeRoute.includes(st);
            const isInShortest = shortestPath.includes(st);

            // Determine if the train is currently visiting this station
            const isTrainHere =
              trainState?.head &&
              (trainState.head.currentStation === st || trainState.head.nextStation === st);

            let platformFill = '#1e293b';
            let platformBorder = '#475569';
            let signalColor = '#94a3b8';

            if (isStart) {
              platformFill = '#1e3a8a';
              platformBorder = '#3b82f6';
              signalColor = '#60a5fa';
            } else if (isAccepting) {
              platformFill = '#064e3b';
              platformBorder = '#10b981';
              signalColor = '#34d399';
            } else if (isDeadEnd) {
              platformFill = '#4c0519';
              platformBorder = '#f43f5e';
              signalColor = '#fb7185';
            } else if (isFailure) {
              platformFill = '#7f1d1d';
              platformBorder = '#ef4444';
              signalColor = '#f87171';
            }

            if (isSelected) {
              platformBorder = '#38bdf8';
            }

            return (
              <g
                key={st}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => handleMouseDownNode(e, st)}
                onClick={() => onSelectStation(st)}
              >
                {/* Station Berth Halo / Train Arrival Highlight */}
                {(isTrainHere || isSelected || isFailure) && (
                  <circle
                    r="32"
                    fill="none"
                    stroke={isFailure ? '#ef4444' : isTrainHere ? activePalette.primary : '#38bdf8'}
                    strokeWidth="2.5"
                    opacity="0.75"
                    className="pulse-animation"
                  />
                )}

                {/* Double Concentric Rings for Automata Accepting States F */}
                {isAccepting && (
                  <circle
                    r="27"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    opacity="0.85"
                  />
                )}

                {/* Station Platform Base Deck */}
                <rect
                  x="-23"
                  y="-17"
                  width="46"
                  height="34"
                  rx="9"
                  fill={platformFill}
                  stroke={platformBorder}
                  strokeWidth="2"
                  filter="drop-shadow(0 4px 10px rgba(0,0,0,0.5))"
                />

                {/* Platform Warning Tactile Edge Stripes (Top & Bottom) */}
                <line x1="-18" y1="-14" x2="18" y2="-14" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
                <line x1="-18" y1="14" x2="18" y2="14" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />

                {/* Railway Station Signal Mast (Mini aspect light on right) */}
                <g transform="translate(18, -14)">
                  <rect x="-3" y="-5" width="6" height="10" rx="3" fill="#090d16" stroke="#475569" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="2.2" fill={signalColor} filter="url(#glow-headlight)" />
                </g>

                {/* Station Role Symbol / Icon */}
                {isStart ? (
                  // Depot Symbol
                  <g transform="translate(0, 0)">
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#ffffff"
                      fontSize="11px"
                      fontFamily="var(--font-mono)"
                      fontWeight="800"
                    >
                      q₀
                    </text>
                  </g>
                ) : isAccepting ? (
                  // Terminus Flag Symbol
                  <g transform="translate(0, 0)">
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#a7f3d0"
                      fontSize="11px"
                      fontFamily="var(--font-mono)"
                      fontWeight="800"
                    >
                      F
                    </text>
                  </g>
                ) : isDeadEnd ? (
                  // Railway Buffer Stop Bumper Icon
                  <g transform="translate(-6, -6)">
                    <rect x="0" y="2" width="12" height="8" rx="1.5" fill="#f43f5e" />
                    <line x1="2" y1="2" x2="10" y2="10" stroke="#ffffff" strokeWidth="1.2" />
                    <line x1="10" y1="2" x2="2" y2="10" stroke="#ffffff" strokeWidth="1.2" />
                  </g>
                ) : (
                  // Standard Station Abbreviation Code
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#cbd5e1"
                    fontSize="10px"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    {st.substring(0, 3).toUpperCase()}
                  </text>
                )}

                {/* Station Nameplate Board (Like classic British/Euro transit signs) */}
                <g transform="translate(0, 27)" pointerEvents="none">
                  <rect
                    x={-(st.length * 4.3 + 12)}
                    y="-9"
                    width={st.length * 8.6 + 24}
                    height="20"
                    rx="5"
                    fill="rgba(10, 15, 29, 0.94)"
                    stroke={
                      isSelected
                        ? '#38bdf8'
                        : isFailure
                        ? '#ef4444'
                        : isTrainHere
                        ? activePalette.primary
                        : 'rgba(255,255,255,0.15)'
                    }
                    strokeWidth={isSelected || isTrainHere ? '1.8' : '1'}
                    filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))"
                  />
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill={isFailure ? '#fca5a5' : isTrainHere ? '#38bdf8' : '#f8fafc'}
                    fontSize="11px"
                    fontWeight="700"
                    fontFamily="var(--font-sans)"
                  >
                    {st}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
