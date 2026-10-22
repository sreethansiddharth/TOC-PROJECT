import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Route as RouteIcon, Sparkles, Navigation } from 'lucide-react';

const TRAIN_TYPES = ['Express', 'Local', 'Freight', 'HighSpeed'];

export default function RouteVerifier({
  network,
  onVerifyRoute,
  onComputeShortestPath,
  verificationResult,
  shortestPathResult,
  loading
}) {
  const [trainType, setTrainType] = useState('Express');
  const [routeInput, setRouteInput] = useState('');
  const [sourceStation, setSourceStation] = useState('');
  const [destinationStation, setDestinationStation] = useState('');

  const stations = network?.stations || [];
  const startStation = network?.start_station;
  const acceptingStations = network?.accepting_stations || [];

  // Initialize defaults from network
  useEffect(() => {
    if (startStation && !sourceStation) {
      setSourceStation(startStation);
    }
    if (acceptingStations.length > 0 && !destinationStation) {
      setDestinationStation(acceptingStations[0]);
    }
  }, [network, startStation, acceptingStations]);

  // Pre-fill route from quick preset or user clicks and dispatch
  const handleQuickPreset = (presetType) => {
    if (presetType === 'proposal_accepted') {
      const type = 'Express';
      const route = ['Central Station', 'Bridgeview', 'Midtown Junction', 'Westfield Terminal'];
      setTrainType(type);
      setRouteInput('Central Station, Bridgeview, Midtown Junction, Westfield Terminal');
      setSourceStation('Central Station');
      setDestinationStation('Westfield Terminal');
      onComputeShortestPath('Central Station', 'Westfield Terminal', type);
      onVerifyRoute(route, type);
    } else if (presetType === 'proposal_rejected_restriction') {
      const type = 'Local';
      const route = ['Central Station', 'Bridgeview', 'Midtown Junction', 'Westfield Terminal'];
      setTrainType(type);
      setRouteInput('Central Station, Bridgeview, Midtown Junction, Westfield Terminal');
      setSourceStation('Central Station');
      setDestinationStation('Westfield Terminal');
      onVerifyRoute(route, type);
      onComputeShortestPath('Central Station', 'Westfield Terminal', type);
    } else if (presetType === 'dead_end_test') {
      const type = 'Freight';
      const route = ['Central Station', 'Bridgeview', 'Old Depot (Dead End)'];
      setTrainType(type);
      setRouteInput('Central Station, Bridgeview, Old Depot (Dead End)');
      setSourceStation('Central Station');
      setDestinationStation('Old Depot (Dead End)');
      onVerifyRoute(route, type);
      onComputeShortestPath('Central Station', 'Old Depot (Dead End)', type);
    }
  };

  const handleVerify = (e) => {
    e.preventDefault();
    const parsedRoute = routeInput
      .split(/[,->\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (parsedRoute.length === 0) return;
    onVerifyRoute(parsedRoute, trainType);
  };

  const handleFindShortest = () => {
    if (!sourceStation || !destinationStation) return;
    onComputeShortestPath(sourceStation, destinationStation, trainType);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Route Verification Form */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
          <RouteIcon size={16} /> Automata Journey Verifier
        </h3>

        {/* Quick Presets for Demo */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
            Quick Demo Scenarios (TOC Proposal):
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem' }}
              onClick={() => handleQuickPreset('proposal_accepted')}
            >
              Express Accepted
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem' }}
              onClick={() => handleQuickPreset('proposal_rejected_restriction')}
            >
              Local Failure at Junction
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem' }}
              onClick={() => handleQuickPreset('dead_end_test')}
            >
              Freight into Dead-End
            </button>
          </div>
        </div>

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Train Service Type (Automaton Input Symbol σ ∈ Σ)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TRAIN_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm ${trainType === type ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTrainType(type)}
                  style={{ flex: 1, fontSize: '0.75rem' }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Proposed Journey Sequence (comma or arrow separated stations)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Central Station, Bridgeview, Midtown Junction, Westfield Terminal"
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={loading} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              <Sparkles size={14} /> Validate Journey
            </button>
          </div>
        </form>
      </div>

      {/* Verification Status Result */}
      {verificationResult && (
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderLeft: `4px solid ${verificationResult.accepted ? '#10b981' : '#f43f5e'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            {verificationResult.accepted ? (
              <CheckCircle2 size={22} color="#10b981" />
            ) : (
              <XCircle size={22} color="#f43f5e" />
            )}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: verificationResult.accepted ? '#6ee7b7' : '#fca5a5' }}>
                {verificationResult.accepted ? 'JOURNEY ACCEPTED' : 'JOURNEY REJECTED'}
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Evaluated under {trainType} rules
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '6px', lineHeight: 1.4 }}>
            {verificationResult.reason}
          </p>

          {!verificationResult.accepted && verificationResult.failure_station && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(244,63,94,0.1)', borderRadius: '6px', fontSize: '0.75rem' }}>
              <span style={{ fontWeight: '600', color: '#fda4af' }}>Point of Failure: </span>
              <span>Station <strong>{verificationResult.failure_station}</strong> (Step {verificationResult.failure_step})</span>
              <br />
              <span style={{ fontWeight: '600', color: '#fda4af' }}>Cause: </span>
              <span className="badge badge-express" style={{ marginLeft: '4px', textTransform: 'none' }}>
                {verificationResult.failure_cause}
              </span>
            </div>
          )}
        </div>
      )}

      {/* BFS Shortest Path Finder */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
          <Navigation size={16} /> BFS Shortest Accepted Path
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Origin (q₀)</label>
            <select value={sourceStation} onChange={(e) => setSourceStation(e.target.value)}>
              <option value="">Select Origin</option>
              {stations.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Destination (F)</label>
            <select value={destinationStation} onChange={(e) => setDestinationStation(e.target.value)}>
              <option value="">Select Destination</option>
              {stations.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFindShortest}
          disabled={!sourceStation || !destinationStation}
          className="btn btn-success btn-sm"
          style={{ width: '100%' }}
        >
          Compute Minimum Hops
        </button>

        {shortestPathResult && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.8rem' }}>
            {shortestPathResult.found ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', color: '#6ee7b7' }}>
                    BFS Shortest Route ({shortestPathResult.hops} hops):
                  </span>
                  <span className="badge badge-local" style={{ fontSize: '0.68rem' }}>
                    {trainType} Service
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontSize: '0.82rem', padding: '6px 8px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {shortestPathResult.path.join(' ➔ ')}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#34d399' }}>
                  <Sparkles size={14} />
                  <span>Interactive train is actively navigating this route on the canvas!</span>
                </div>
              </div>
            ) : (
              <span style={{ color: '#fda4af' }}>{shortestPathResult.message}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
