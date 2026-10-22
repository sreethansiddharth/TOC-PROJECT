import React from 'react';
import { AlertCircle, AlertTriangle, ShieldCheck, Download, FileText, CheckCircle2 } from 'lucide-react';

export default function AnalysisReportDrawer({
  consistency,
  deadEnds,
  lastReport,
  onGenerateReport,
  onExportReport
}) {
  const warnings = consistency?.warnings || [];
  const orphans = consistency?.orphaned_stations || [];
  const unreachable = consistency?.unreachable_from_start || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Network Structural Consistency */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
            <AlertTriangle size={16} /> Automata Consistency & Audit
          </h3>
          {warnings.length === 0 ? (
            <span className="badge badge-local" style={{ fontSize: '0.7rem' }}>
              <ShieldCheck size={12} /> Sound
            </span>
          ) : (
            <span className="badge badge-freight" style={{ fontSize: '0.7rem' }}>
              {warnings.length} Warnings
            </span>
          )}
        </div>

        {warnings.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Railway network is structurally consistent. All stations are connected and reachable from start station.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  fontSize: '0.75rem',
                  color: '#fde68a'
                }}
              >
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Dead ends list */}
        {deadEnds && deadEnds.length > 0 && (
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', fontSize: '0.75rem' }}>
            <span style={{ fontWeight: '700', color: '#fb7185' }}>Dead-End Stations Detected ({deadEnds.length}):</span>
            <div style={{ marginTop: '4px', color: '#e2e8f0' }}>
              {deadEnds.join(', ')}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
              * Non-accepting stations with zero permitted outward connections.
            </div>
          </div>
        )}
      </div>

      {/* Verification Report & Export */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7' }}>
            <FileText size={16} /> Formal Verification Report
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onExportReport} disabled={!lastReport} title="Export JSON Report">
            <Download size={14} /> Export
          </button>
        </div>

        {lastReport ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>STATUS:</span>
              <strong style={{ color: lastReport.accepted ? '#34d399' : '#f87171' }}>{lastReport.status}</strong>
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span>TRAIN TYPE:</span> {lastReport.train_type}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span>PROPOSED ROUTE:</span>
              <div style={{ color: '#38bdf8', marginTop: '2px' }}>{lastReport.proposed_route?.join(' ➔ ') || 'N/A'}</div>
            </div>
            {lastReport.shortest_path?.found && (
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span>MINIMUM BFS HOPS:</span> {lastReport.shortest_path.hops}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Run a route verification to produce an official automata audit report.
          </p>
        )}
      </div>
    </div>
  );
}
