import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Upload,
  Sparkles,
  Route,
  GitBranch,
  ShieldAlert,
  Unlink,
  TrainTrack,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function TestLab({ onLoadNetwork, onNavigateToGraph }) {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suiteResults, setSuiteResults] = useState(null);
  const [runningSuite, setRunningSuite] = useState(false);
  const [activeLoadedId, setActiveLoadedId] = useState(null);

  // Fetch demo networks catalog
  const fetchDemos = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/demo-networks');
      const data = await res.json();
      setDemos(data.demo_networks || []);
    } catch (err) {
      console.error('Failed to fetch demo networks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemos();
  }, []);

  // Run full curated test suite
  const handleRunAllTests = async () => {
    try {
      setRunningSuite(true);
      const res = await fetch('/api/demo-networks/run-tests', { method: 'POST' });
      const data = await res.json();
      setSuiteResults(data);
    } catch (err) {
      console.error('Failed to run test suite:', err);
    } finally {
      setRunningSuite(false);
    }
  };

  // Load a demo network
  const handleLoadDemo = async (demoId) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/demo-networks/load/${demoId}`, { method: 'POST' });
      const data = await res.json();
      setActiveLoadedId(demoId);
      if (onLoadNetwork) {
        onLoadNetwork(data.network);
      }
    } catch (err) {
      console.error('Failed to load demo network:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScenarioIcon = (id) => {
    switch (id) {
      case 'linear': return <Route size={18} color="#38bdf8" />;
      case 'branching': return <GitBranch size={18} color="#a855f7" />;
      case 'dead-end': return <ShieldAlert size={18} color="#f43f5e" />;
      case 'disconnected': return <Unlink size={18} color="#fbbf24" />;
      case 'train-restrictions': return <TrainTrack size={18} color="#10b981" />;
      case 'multiple-routes': return <Compass size={18} color="#6366f1" />;
      default: return <FlaskConical size={18} color="#38bdf8" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Master Runner */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FlaskConical size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>Automated Test-Network Laboratory (Upgrade 3)</h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
            Predefined railway topologies (Scenarios A through F) for academic demonstrations and automated verification.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRunAllTests}
          disabled={runningSuite}
          style={{ background: 'linear-gradient(135deg, #0284c7, #6366f1)', fontSize: '0.82rem' }}
        >
          <Sparkles size={15} /> {runningSuite ? 'Running Test Suite...' : 'Run All Test Scenarios'}
        </button>
      </div>

      {/* Test Suite Results Dashboard */}
      {suiteResults && (
        <div className="glass-panel" style={{ padding: '16px', borderLeft: `4px solid ${suiteResults.all_passed ? '#10b981' : '#f43f5e'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {suiteResults.all_passed ? (
                <CheckCircle2 size={22} color="#10b981" />
              ) : (
                <XCircle size={22} color="#f43f5e" />
              )}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: suiteResults.all_passed ? '#6ee7b7' : '#fca5a5' }}>
                  {suiteResults.all_passed ? 'ALL SUITE TESTS PASSED (100%)' : 'SOME TESTS FAILED'}
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Curated backend verification suite executed across all 6 scenarios
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                {suiteResults.total_passed} Passed
              </span>
              {suiteResults.total_failed > 0 && (
                <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185' }}>
                  {suiteResults.total_failed} Failed
                </span>
              )}
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                {suiteResults.total_tests} Total Checks
              </span>
            </div>
          </div>

          {/* Test cases list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suiteResults.results?.map((t, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {t.passed ? <CheckCircle2 size={15} color="#10b981" /> : <XCircle size={15} color="#f43f5e" />}
                    <strong style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{t.test_name}</strong>
                    <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)' }}>
                      {t.scenario}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: t.passed ? '#34d399' : '#f43f5e', fontWeight: '700' }}>
                    {t.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                  <div><strong>Expected:</strong> <span style={{ color: '#cbd5e1' }}>{t.expected}</span></div>
                  <div><strong>Actual:</strong> <span style={{ color: t.passed ? '#6ee7b7' : '#fca5a5' }}>{t.actual}</span></div>
                </div>

                {t.details && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                    Note: {t.details}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 Predefined Demo Scenarios Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {demos.map((d) => {
          const isLoaded = activeLoadedId === d.id;

          return (
            <div
              key={d.id}
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: isLoaded ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                background: isLoaded ? 'rgba(56, 189, 248, 0.05)' : undefined
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getScenarioIcon(d.id)}
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700' }}>{d.name}</h4>
                  </div>
                  <span className="badge badge-express" style={{ fontSize: '0.68rem' }}>
                    {d.scenario?.split('.')[0] || 'Demo'}
                  </span>
                </div>

                <p style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '12px' }}>
                  {d.description}
                </p>

                {/* Network Properties */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', fontSize: '0.7rem' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 7px', borderRadius: '4px', color: '#cbd5e1' }}>
                    Start: <strong>{d.start_station}</strong>
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 7px', borderRadius: '4px', color: '#cbd5e1' }}>
                    Terminals: <strong>{d.accepting_stations?.join(', ')}</strong>
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 7px', borderRadius: '4px', color: '#cbd5e1' }}>
                    Stations: <strong>{d.stations_count}</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isLoaded ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '0.75rem' }}
                  onClick={() => handleLoadDemo(d.id)}
                  disabled={loading}
                >
                  <Upload size={13} /> {isLoaded ? 'Active on Canvas' : 'Load into Canvas'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
