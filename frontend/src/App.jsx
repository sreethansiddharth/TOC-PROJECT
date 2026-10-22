import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Train,
  Sliders,
  Play,
  RotateCcw,
  Save,
  FolderOpen,
  HelpCircle,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import RailwayGraph from './components/RailwayGraph';
import NetworkBuilder from './components/NetworkBuilder';
import RouteVerifier from './components/RouteVerifier';
import AnalysisReportDrawer from './components/AnalysisReportDrawer';

export default function App() {
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('verifier'); // 'verifier' | 'builder' | 'analysis'
  const [selectedStation, setSelectedStation] = useState(null);

  // Verification & Analysis state
  const [activeRoute, setActiveRoute] = useState([]);
  const [trainType, setTrainType] = useState('Express');
  const [verificationResult, setVerificationResult] = useState(null);
  const [shortestPathResult, setShortestPathResult] = useState(null);
  const [deadEnds, setDeadEnds] = useState([]);
  const [consistency, setConsistency] = useState(null);
  const [lastReport, setLastReport] = useState(null);

  // Saved networks list
  const [savedNetworks, setSavedNetworks] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNetworkName, setSaveNetworkName] = useState('');

  // 1. Fetch current network on mount
  const fetchNetwork = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/network');
      const data = await res.json();
      setNetwork(data.network);
      runConsistencyAudit(data.network);

      // Pre-compute initial BFS shortest path so train is active on load
      const startSt = data.network?.start_station;
      const accSt = data.network?.accepting_stations?.[0];
      if (startSt && accSt) {
        handleComputeShortestPath(startSt, accSt, 'Express');
      }
    } catch (err) {
      console.error('Failed to fetch network:', err);
    } finally {
      setLoading(false);
    }
  };

  const runConsistencyAudit = async (net) => {
    try {
      const [consRes, deadRes] = await Promise.all([
        fetch('/api/analysis/consistency'),
        fetch('/api/analysis/dead-ends?train_type=Express')
      ]);
      const consData = await consRes.json();
      const deadData = await deadRes.json();
      setConsistency(consData);
      setDeadEnds(deadData.dead_end_stations || []);
    } catch (e) {
      console.error('Failed consistency audit:', e);
    }
  };

  useEffect(() => {
    fetchNetwork();
    fetchSavedNetworks();
  }, []);

  const fetchSavedNetworks = async () => {
    try {
      const res = await fetch('/api/networks/list');
      const data = await res.json();
      setSavedNetworks(data);
    } catch (err) {
      console.error('Failed to list networks:', err);
    }
  };

  // Node Dragging on canvas
  const handleStationDrag = (stationName, x, y) => {
    if (!network) return;
    setNetwork(prev => ({
      ...prev,
      station_metadata: {
        ...(prev.station_metadata || {}),
        [stationName]: {
          ...(prev.station_metadata?.[stationName] || {}),
          x,
          y
        }
      }
    }));
  };

  // Station Management
  const handleAddStation = async (name, isStart, isAccepting) => {
    try {
      const res = await fetch('/api/network/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_start: isStart, is_accepting: isAccepting })
      });
      const data = await res.json();
      setNetwork(data.network);
      runConsistencyAudit(data.network);
    } catch (err) {
      console.error('Error adding station:', err);
    }
  };

  const handleDeleteStation = async (stationName) => {
    try {
      const res = await fetch(`/api/network/station/${encodeURIComponent(stationName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      setNetwork(data.network);
      runConsistencyAudit(data.network);
    } catch (err) {
      console.error('Error deleting station:', err);
    }
  };

  // Transition Management
  const handleAddTransition = async (source, target, trainTypes) => {
    try {
      const res = await fetch('/api/network/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target, train_types: trainTypes })
      });
      const data = await res.json();
      setNetwork(data.network);
      runConsistencyAudit(data.network);
    } catch (err) {
      console.error('Error adding transition:', err);
    }
  };

  const handleSetStart = async (station) => {
    try {
      await fetch('/api/network/set-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station })
      });
      fetchNetwork();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAccepting = async (station) => {
    if (!network) return;
    const current = new Set(network.accepting_stations || []);
    if (current.has(station)) {
      current.delete(station);
    } else {
      current.add(station);
    }
    try {
      await fetch('/api/network/set-accepting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stations: Array.from(current) })
      });
      fetchNetwork();
    } catch (err) {
      console.error(err);
    }
  };

  // Route Verification
  const handleVerifyRoute = async (route, selectedTrainType) => {
    try {
      setLoading(true);
      setActiveRoute(route);
      setTrainType(selectedTrainType);
      const res = await fetch('/api/verify-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, train_type: selectedTrainType })
      });
      const result = await res.json();
      setVerificationResult(result);

      // Trigger celebrate confetti if route is accepted!
      if (result.accepted) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // Also generate formal report
      const repRes = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, train_type: selectedTrainType })
      });
      const repData = await repRes.json();
      setLastReport(repData);
    } catch (err) {
      console.error('Route verification failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Shortest Path Finder
  const handleComputeShortestPath = async (source, destination, selectedTrainType) => {
    try {
      setLoading(true);
      setTrainType(selectedTrainType);
      const res = await fetch('/api/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination, train_type: selectedTrainType })
      });
      const data = await res.json();
      setShortestPathResult(data);
    } catch (err) {
      console.error('Shortest path error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset to default network
  const handleResetDefault = async () => {
    try {
      const res = await fetch('/api/network/reset-default', { method: 'POST' });
      const data = await res.json();
      setNetwork(data.network);
      setActiveRoute([]);
      setVerificationResult(null);
      setShortestPathResult(null);
      runConsistencyAudit(data.network);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // Save network
  const handleSaveNetwork = async () => {
    if (!saveNetworkName.trim()) return;
    try {
      await fetch('/api/networks/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveNetworkName.trim(), network })
      });
      setShowSaveModal(false);
      setSaveNetworkName('');
      fetchSavedNetworks();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleLoadNetwork = async (id) => {
    try {
      const res = await fetch(`/api/networks/load/${id}`, { method: 'POST' });
      const data = await res.json();
      setNetwork(data.network);
      setActiveRoute([]);
      setVerificationResult(null);
      setShortestPathResult(null);
      runConsistencyAudit(data.network);
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const handleExportReport = () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Verification_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #0284c7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}>
            <Train size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smart Railway Route Verifier
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Theory of Computation & Automata Theory • Finite Automaton Verification Engine
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleResetDefault} title="Reset Showcase Demo Network">
            <RotateCcw size={14} /> Reset Network
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(true)}>
            <Save size={14} /> Save Network
          </button>

          {savedNetworks.length > 0 && (
            <select
              style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px' }}
              onChange={(e) => e.target.value && handleLoadNetwork(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Load Saved Network...</option>
              {savedNetworks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          )}
        </div>
      </header>

      {/* Main Grid Layout: Graph Visualization (Left) + Interactive Panels (Right) */}
      <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Interactive Graph View */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#38bdf8" />
                <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Automaton State Graph Canvas</h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Drag nodes to reposition • Pan & zoom supported
              </span>
            </div>

            <RailwayGraph
              network={network}
              activeRoute={activeRoute}
              failureStation={verificationResult?.failure_station}
              deadEndStations={deadEnds}
              shortestPath={shortestPathResult?.path || []}
              selectedStation={selectedStation}
              trainType={trainType}
              shortestPathResult={shortestPathResult}
              verificationResult={verificationResult}
              onSelectStation={(s) => setSelectedStation(s)}
              onStationDrag={handleStationDrag}
            />
          </div>

          {/* Automata Formal Specification Card */}
          <div className="glass-panel" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>States Q (Stations)</span>
              <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{network?.stations?.length || 0}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>Initial State q₀</span>
              <strong style={{ fontSize: '0.9rem', color: '#60a5fa' }}>{network?.start_station || 'None'}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>Accepting States F</span>
              <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>{network?.accepting_stations?.length || 0}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>Transitions δ</span>
              <strong style={{ fontSize: '1.1rem', color: '#a855f7' }}>{network?.transitions?.length || 0}</strong>
            </div>
          </div>
        </section>

        {/* Right Column: Tabbed Control Panel */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'verifier' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('verifier')}
            >
              Route Verifier
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'builder' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('builder')}
            >
              Network Builder
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'analysis' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('analysis')}
            >
              Audit & Reports
            </button>
          </div>

          {/* Active Tab Views */}
          {activeTab === 'verifier' && (
            <RouteVerifier
              network={network}
              onVerifyRoute={handleVerifyRoute}
              onComputeShortestPath={handleComputeShortestPath}
              verificationResult={verificationResult}
              shortestPathResult={shortestPathResult}
              loading={loading}
            />
          )}

          {activeTab === 'builder' && (
            <NetworkBuilder
              network={network}
              onAddStation={handleAddStation}
              onDeleteStation={handleDeleteStation}
              onAddTransition={handleAddTransition}
              onSetStart={handleSetStart}
              onToggleAccepting={handleToggleAccepting}
              selectedStation={selectedStation}
            />
          )}

          {activeTab === 'analysis' && (
            <AnalysisReportDrawer
              consistency={consistency}
              deadEnds={deadEnds}
              lastReport={lastReport}
              onGenerateReport={() => {}}
              onExportReport={handleExportReport}
            />
          )}
        </section>
      </main>

      {/* Save Network Modal */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '380px', padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px' }}>Save Railway Network</h3>
            <input
              type="text"
              placeholder="e.g. Northern High-Speed Corridor"
              value={saveNetworkName}
              onChange={(e) => setSaveNetworkName(e.target.value)}
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNetwork} disabled={!saveNetworkName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
