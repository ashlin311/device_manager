import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import DeviceCard from '../components/DeviceCard';
import CommandBar from '../components/CommandBar';

export default function Dashboard() {
  const { devices } = useWebSocket();

  // Compute simple statistics
  const total = devices.length;
  const online = devices.filter((d) => d.status?.toLowerCase() === 'online').length;
  const offline = devices.filter((d) => d.status?.toLowerCase() === 'offline').length;
  const other = total - online - offline;

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <h1 className="page-title">Endpoint Console</h1>
        <p className="page-subtitle">Monitor device health and dispatch real-time commands</p>
      </header>

      {/* Natural Language Input */}
      <CommandBar />

      {/* Metrics Totals */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Endpoints</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(34, 197, 94, 0.2)' }}>
          <div className="stat-value" style={{ color: 'var(--status-online)', webkitTextFillColor: 'initial' }}>{online}</div>
          <div className="stat-label">Active Online</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="stat-value" style={{ color: 'var(--status-offline)', webkitTextFillColor: 'initial' }}>{offline}</div>
          <div className="stat-label">Offline</div>
        </div>
        {other > 0 && (
          <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <div className="stat-value" style={{ color: 'var(--status-unreachable)', webkitTextFillColor: 'initial' }}>{other}</div>
            <div className="stat-label">Unreachable</div>
          </div>
        )}
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">🖥️</div>
          <h3 style={{ marginBottom: '8px' }}>No Devices Connected</h3>
          <p className="empty-state-text">
            Start the python telemetry agent (`python agent.py`) on a client device to register it.
          </p>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
