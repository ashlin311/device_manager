import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DeviceCard({ device }) {
  const navigate = useNavigate();

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'online';
      case 'offline':
        return 'offline';
      default:
        return 'unreachable';
    }
  };

  const getMetricLevel = (value) => {
    if (value > 80) return 'high';
    if (value > 50) return 'medium';
    return 'low';
  };

  const handleClick = () => {
    navigate(`/devices/${device.id}`);
  };

  return (
    <div className="glass-card device-card fade-in-up" onClick={handleClick}>
      <div className="device-card-header">
        <div>
          <h3 className="device-name">{device.name}</h3>
          <div className="device-hostname">{device.hostname || 'Unknown hostname'}</div>
        </div>
        <span className={`status-badge ${getStatusClass(device.status)}`}>
          <span className={`status-dot ${getStatusClass(device.status)}`} />
          {device.status || 'unknown'}
        </span>
      </div>

      <div className="device-metrics">
        <div className="metric">
          <div className="metric-label">CPU Usage</div>
          <div className="metric-value">
            {device.cpu_usage != null ? `${Math.round(device.cpu_usage)}%` : 'N/A'}
          </div>
          {device.cpu_usage != null && (
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getMetricLevel(device.cpu_usage)}`}
                style={{ width: `${device.cpu_usage}%` }}
              />
            </div>
          )}
        </div>

        <div className="metric">
          <div className="metric-label">RAM Usage</div>
          <div className="metric-value">
            {device.ram_usage != null ? `${Math.round(device.ram_usage)}%` : 'N/A'}
          </div>
          {device.ram_usage != null && (
            <div className="progress-bar">
              <div 
                className={`progress-fill ${getMetricLevel(device.ram_usage)}`}
                style={{ width: `${device.ram_usage}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <div>Cores: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{device.cpu_cores || 'N/A'}</span></div>
        <div>Total RAM: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{device.ram_total_gb ? `${device.ram_total_gb} GB` : 'N/A'}</span></div>
      </div>

      <div className="device-footer">
        <span className="device-os">
          💻 {device.os || 'Unknown OS'}
        </span>
        <span className="device-ip">
          {device.ip_address || '0.0.0.0'}
        </span>
      </div>
    </div>
  );
}
