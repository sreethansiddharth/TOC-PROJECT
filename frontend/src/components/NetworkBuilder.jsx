import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Flag, Navigation } from 'lucide-react';

const TRAIN_TYPES = ['Express', 'Local', 'Freight', 'HighSpeed'];

export default function NetworkBuilder({
  network,
  onAddStation,
  onDeleteStation,
  onAddTransition,
  onDeleteTransition,
  onSetStart,
  onToggleAccepting,
  selectedStation
}) {
  const [stationName, setStationName] = useState('');
  const [isStart, setIsStart] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Transition form state
  const [sourceStation, setSourceStation] = useState('');
  const [targetStation, setTargetStation] = useState('');
  const [selectedTrainTypes, setSelectedTrainTypes] = useState(['Express']);

  const stations = network?.stations || [];
  const startStation = network?.start_station;
  const acceptingStations = new Set(network?.accepting_stations || []);
  const transitions = network?.transitions || [];

  const handleCreateStation = (e) => {
    e.preventDefault();
    if (!stationName.trim()) return;
    onAddStation(stationName.trim(), isStart, isAccepting);
    setStationName('');
    setIsStart(false);
    setIsAccepting(false);
  };

  const handleCreateTransition = (e) => {
    e.preventDefault();
    if (!sourceStation || !targetStation || selectedTrainTypes.length === 0) return;
    onAddTransition(sourceStation, targetStation, selectedTrainTypes);
    setSourceStation('');
    setTargetStation('');
  };

  const toggleTrainType = (type) => {
    if (selectedTrainTypes.includes(type)) {
      if (selectedTrainTypes.length > 1) {
        setSelectedTrainTypes(selectedTrainTypes.filter(t => t !== type));
      }
    } else {
      setSelectedTrainTypes([...selectedTrainTypes, type]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Add Station Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
          <Plus size={16} /> Add Station (Automata State)
        </h3>
        <form onSubmit={handleCreateStation} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="e.g. Grand Terminal, Station B"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isStart}
                onChange={(e) => setIsStart(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Initial State (q₀)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isAccepting}
                onChange={(e) => setIsAccepting(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Accepting / Destination (F)
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
            Add Station
          </button>
        </form>
      </div>

      {/* 2. Add Track Transition Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
          <ArrowRight size={16} /> Add Track Transition δ(q, σ) → q'
        </h3>
        <form onSubmit={handleCreateTransition} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>From Station</label>
              <select value={sourceStation} onChange={(e) => setSourceStation(e.target.value)}>
                <option value="">Select Origin</option>
                {stations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>To Station</label>
              <select value={targetStation} onChange={(e) => setTargetStation(e.target.value)}>
                <option value="">Select Destination</option>
                {stations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>
              Permitted Train Types (Alphabet Σ)
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TRAIN_TYPES.map(type => {
                const active = selectedTrainTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTrainType(type)}
                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn btn-success btn-sm" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
            Connect Track
          </button>
        </form>
      </div>

      {/* 3. Stations List & Quick Roles */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '10px', color: '#cbd5e1' }}>
          Station Hierarchy & Roles ({stations.length})
        </h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {stations.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No stations added yet.</div>
          ) : (
            stations.map(s => {
              const isStartStation = (s === startStation);
              const isAcceptingStation = acceptingStations.has(s);

              return (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: selectedStation === s ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '600' }}>{s}</span>
                    {isStartStation && <span className="badge badge-express" style={{ fontSize: '0.65rem' }}>Start</span>}
                    {isAcceptingStation && <span className="badge badge-local" style={{ fontSize: '0.65rem' }}>Accepting</span>}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => onSetStart(s)}
                      title="Set as Start Station"
                    >
                      <Flag size={12} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => onToggleAccepting(s)}
                      title="Toggle Accepting State"
                    >
                      <Navigation size={12} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => onDeleteStation(s)}
                      title="Delete Station"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
