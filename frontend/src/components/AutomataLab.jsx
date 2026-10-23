import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  ArrowRight,
  GitFork,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Share2,
  ShieldCheck,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

export default function AutomataLab({ network }) {
  const [alphabetMode, setAlphabetMode] = useState('train_types');
  const [selectedTrainFilter, setSelectedTrainFilter] = useState('');
  const [automataData, setAutomataData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Simulation State
  const [simulationInput, setSimulationInput] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simStep, setSimStep] = useState(0);

  // DFA Conversion State
  const [dfaResult, setDfaResult] = useState(null);
  const [converting, setConverting] = useState(false);
  const [includeTrapState, setIncludeTrapState] = useState(true);

  // Fetch classification and formal model
  const fetchAutomataData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('alphabet_mode', alphabetMode);
      if (selectedTrainFilter) {
        params.append('train_type', selectedTrainFilter);
      }
      const res = await fetch(`/api/automata/classify?${params.toString()}`);
      const data = await res.json();
      setAutomataData(data);
      setDfaResult(null);
      setSimulationResult(null);
    } catch (err) {
      console.error('Failed to fetch automata data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomataData();
  }, [network, alphabetMode, selectedTrainFilter]);

  // Handle Input Simulation
  const handleSimulate = async () => {
    if (simulationInput.length === 0) return;
    try {
      setLoading(true);
      const res = await fetch('/api/automata/simulate-nfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_symbols: simulationInput,
          alphabet_mode: alphabetMode,
          train_type: selectedTrainFilter || undefined
        })
      });
      const data = await res.json();
      setSimulationResult(data);
      setSimStep(data.trace?.length - 1 || 0);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert NFA to DFA
  const handleConvertToDFA = async () => {
    try {
      setConverting(true);
      const res = await fetch('/api/automata/convert-to-dfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alphabet_mode: alphabetMode,
          train_type: selectedTrainFilter || undefined,
          include_trap: includeTrapState
        })
      });
      const data = await res.json();
      setDfaResult(data);
    } catch (err) {
      console.error('DFA conversion failed:', err);
    } finally {
      setConverting(false);
    }
  };

  const model = automataData?.model;
  const classification = automataData?.classification;
  const alphabet = model?.alphabet || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Automata Theory Lab (Upgrade 1)</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Formal Specification M = (Q, Σ, δ, q₀, F) & Subset Construction
          </span>
        </div>

        {/* Configuration Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Alphabet Definition Mode (Σ)
            </label>
            <select
              value={alphabetMode}
              onChange={(e) => setAlphabetMode(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            >
              <option value="train_types">Train Types as Alphabet Σ</option>
              <option value="stations">Track Destination Station as Σ</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Train Service Filter
            </label>
            <select
              value={selectedTrainFilter}
              onChange={(e) => setSelectedTrainFilter(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            >
              <option value="">All Permitted Services (Unified)</option>
              <option value="Express">Express Only</option>
              <option value="Local">Local Only</option>
              <option value="Freight">Freight Only</option>
              <option value="HighSpeed">HighSpeed Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formal Definition 5-Tuple Card */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#38bdf8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={15} /> Formal Finite Automaton 5-Tuple Definition
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8', display: 'block' }}>States Q</span>
            <strong style={{ fontSize: '1rem', color: '#38bdf8' }}>{model?.states?.length || 0} stations</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8', display: 'block' }}>Alphabet Σ</span>
            <strong style={{ fontSize: '1rem', color: '#f59e0b' }}>
              {alphabet.length > 0 ? `{ ${alphabet.join(', ')} }` : '∅'}
            </strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8', display: 'block' }}>Initial State q₀</span>
            <strong style={{ fontSize: '0.95rem', color: '#60a5fa' }}>{model?.start_state || 'None'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8', display: 'block' }}>Accepting F</span>
            <strong style={{ fontSize: '1rem', color: '#34d399' }}>
              {model?.accepting_states?.length || 0} terminal(s)
            </strong>
          </div>
        </div>
      </div>

      {/* Determinism Classification Card */}
      {classification && (
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderLeft: `4px solid ${classification.is_nfa ? '#f59e0b' : '#10b981'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {classification.is_nfa ? (
                <GitFork size={22} color="#f59e0b" />
              ) : (
                <ShieldCheck size={22} color="#10b981" />
              )}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: classification.is_nfa ? '#fbbf24' : '#6ee7b7' }}>
                  {classification.classification}
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Determinism Status: {classification.is_deterministic ? 'Deterministic' : 'Nondeterministic (Branching Paths)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="badge" style={{ background: classification.is_nfa ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: classification.is_nfa ? '#fbbf24' : '#34d399' }}>
                {classification.nondeterministic_count} Branch Points
              </span>
              <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                {classification.missing_count} Undefined Transitions
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45, marginTop: '6px' }}>
            {classification.explanation}
          </p>

          {/* Nondeterministic branch details */}
          {classification.nondeterministic_transitions?.length > 0 && (
            <div style={{ marginTop: '12px', background: 'rgba(245, 158, 11, 0.08)', padding: '10px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '700', color: '#fbbf24', display: 'block', marginBottom: '6px' }}>
                ⚡ Branching Non-Deterministic Transitions Identified:
              </span>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.75rem', color: '#fef3c7' }}>
                {classification.nondeterministic_transitions.map((nt, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    <strong>{nt.state}</strong> on input <code>'{nt.symbol}'</code> splits to: <strong>[{nt.destinations.join(', ')}]</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Formal Transition Table */}
      {classification?.transition_table && (
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: '#38bdf8' }}>
            Automaton Transition Table δ: Q × Σ → 2^Q
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>State q ∈ Q</th>
                  {alphabet.map((sym) => (
                    <th key={sym} style={{ padding: '8px 10px', textAlign: 'left', color: '#38bdf8' }}>
                      σ = {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classification.transition_table.map((row) => (
                  <tr key={row.state} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: '600' }}>
                      {row.is_start && <span style={{ color: '#60a5fa', marginRight: '4px' }}>→ </span>}
                      {row.is_accepting && <span style={{ color: '#34d399', marginRight: '4px' }}>* </span>}
                      {row.state}
                      {row.is_start && <span style={{ fontSize: '0.65rem', color: '#60a5fa', marginLeft: '6px' }}>(q₀)</span>}
                      {row.is_accepting && <span style={{ fontSize: '0.65rem', color: '#34d399', marginLeft: '6px' }}>(F)</span>}
                    </td>
                    {alphabet.map((sym) => {
                      const dests = row.transitions?.[sym] || [];
                      const isBranching = dests.length > 1;
                      const isMissing = dests.length === 0;

                      return (
                        <td key={sym} style={{ padding: '8px 10px' }}>
                          {isMissing ? (
                            <span style={{ color: '#64748b' }}>∅</span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isBranching ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                                color: isBranching ? '#fbbf24' : '#7dd3fc',
                                fontWeight: isBranching ? '700' : 'normal'
                              }}
                            >
                              {`{ ${dests.join(', ')} }`}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', display: 'block' }}>
            Legend: ➔ initial state (q₀) • * accepting state (F) • ∅ undefined transition (dead end)
          </span>
        </div>
      )}

      {/* Input String Simulation Panel */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Play size={15} /> NFA String Simulation (Active Powerset Tracking)
        </h4>

        {/* Alphabet Token Selector */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
            Click symbols to append to input sequence w ∈ Σ*:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {alphabet.map((sym) => (
              <button
                key={sym}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem' }}
                onClick={() => setSimulationInput([...simulationInput, sym])}
              >
                + {sym}
              </button>
            ))}
            {simulationInput.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', color: '#f43f5e' }}
                onClick={() => {
                  setSimulationInput([]);
                  setSimulationResult(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Current Input String */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Input string w:</span>
          {simulationInput.length === 0 ? (
            <em style={{ fontSize: '0.75rem', color: '#64748b' }}>ε (empty string)</em>
          ) : (
            simulationInput.map((sym, idx) => (
              <span key={idx} className="badge" style={{ background: '#0284c7', color: '#fff' }}>
                {sym}
              </span>
            ))
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
            onClick={handleSimulate}
            disabled={simulationInput.length === 0 || loading}
          >
            <Sparkles size={13} /> Run NFA Simulation
          </button>
        </div>

        {/* Simulation Output */}
        {simulationResult && (
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              {simulationResult.accepted ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <XCircle size={18} color="#f43f5e" />
              )}
              <strong style={{ fontSize: '0.85rem', color: simulationResult.accepted ? '#6ee7b7' : '#fca5a5' }}>
                {simulationResult.accepted ? 'STRING ACCEPTED BY NFA' : 'STRING REJECTED BY NFA'}
              </strong>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '10px' }}>
              {simulationResult.message}
            </p>

            {/* Stepper Visualization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {simulationResult.trace?.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: idx === simStep ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: idx === simStep ? '1px solid #38bdf8' : '1px solid transparent',
                    fontSize: '0.75rem'
                  }}
                >
                  <span style={{ color: '#94a3b8', minWidth: '50px' }}>Step {step.step}:</span>
                  {step.symbol && (
                    <span className="badge badge-express" style={{ minWidth: '70px', textAlign: 'center' }}>
                      σ = {step.symbol}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ color: '#64748b' }}>Active States S_{step.step}:</span>
                    <strong style={{ color: step.active_states.length > 0 ? '#38bdf8' : '#f43f5e' }}>
                      {step.active_states.length > 0 ? `{ ${step.active_states.join(', ')} }` : '∅ (Empty Set)'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subset Construction: Convert NFA to DFA */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Share2 size={16} /> Subset Construction: Convert NFA to DFA
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Powerset Construction Algorithm: Computes an equivalent deterministic finite automaton
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="checkbox"
                checked={includeTrapState}
                onChange={(e) => setIncludeTrapState(e.target.checked)}
              />
              Include Trap State ∅
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', fontSize: '0.75rem' }}
              onClick={handleConvertToDFA}
              disabled={converting}
            >
              <Sparkles size={13} /> {converting ? 'Constructing DFA...' : 'Convert NFA to DFA'}
            </button>
          </div>
        </div>

        {/* Converted DFA Output */}
        {dfaResult && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Equivalence Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle2 size={18} color="#10b981" />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>
                  Equivalent DFA Successfully Constructed!
                </strong>
                <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block' }}>
                  Resulting DFA contains {dfaResult.total_dfa_states} states and {dfaResult.total_dfa_transitions} transitions.
                  Equivalence verified on test suite.
                </span>
              </div>
            </div>

            {/* DFA Transition Table */}
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#c084fc', display: 'block', marginBottom: '8px' }}>
                Converted DFA State Transition Table:
              </span>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>DFA Subset State</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Underlying NFA States</th>
                      {dfaResult.dfa?.alphabet?.map((sym) => (
                        <th key={sym} style={{ padding: '8px 10px', textAlign: 'left', color: '#c084fc' }}>
                          σ = {sym}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dfaResult.dfa?.table?.map((row) => (
                      <tr key={row.state} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                          {row.is_start && <span style={{ color: '#60a5fa' }}>→ </span>}
                          {row.is_accepting && <span style={{ color: '#34d399' }}>* </span>}
                          <span style={{ color: row.is_accepting ? '#34d399' : '#e2e8f0' }}>{row.state}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>
                          {row.nfa_subsets?.length > 0 ? `{ ${row.nfa_subsets.join(', ')} }` : '∅'}
                        </td>
                        {dfaResult.dfa?.alphabet?.map((sym) => (
                          <td key={sym} style={{ padding: '8px 10px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.1)', color: '#d8b4fe' }}>
                              {row.transitions?.[sym] || '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equivalence Test Sample Results */}
            {dfaResult.sample_equivalence_tests?.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Empirical Equivalence Checks (NFA vs Converted DFA):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                  {dfaResult.sample_equivalence_tests.map((eq, i) => (
                    <div key={i} style={{ fontSize: '0.72rem', background: 'rgba(15,23,42,0.5)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Input: [{eq.input.join(', ')}]</span>
                      <span style={{ color: eq.equivalent ? '#34d399' : '#f43f5e', fontWeight: '700' }}>
                        {eq.equivalent ? '✓ Match' : '✗ Disagree'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
