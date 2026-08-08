import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { devices, commands } = useWebSocket();

  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal/Prompt states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync device from WebSocketContext if it updates in real time
  useEffect(() => {
    const wsDevice = devices.find((d) => d.id === id);
    if (wsDevice) {
      setDevice(wsDevice);
    }
  }, [devices, id]);

  // Fetch initial device detail and command history
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch single device
        const deviceRes = await fetch(`${API_BASE}/devices/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!deviceRes.ok) {
          throw new Error('Device not found');
        }
        const deviceData = await deviceRes.json();
        setDevice(deviceData);

        // 2. Fetch commands history
        const historyRes = await fetch(`${API_BASE}/devices/${id}/commands`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData);
        }
      } catch (err) {
        setError(err.message || 'Error loading device data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, token]);

  // Listen to command updates from WebSockets and update the history table
  useEffect(() => {
    if (Object.keys(commands).length === 0) return;

    setHistory((prevHistory) => {
      return prevHistory.map((cmd) => {
        if (commands[cmd.id]) {
          return commands[cmd.id]; // Replace with updated command (contains final status, result, completed_at)
        }
        return cmd;
      });
    });
  }, [commands]);

  const dispatchCommand = async (action, payload = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_id: id,
          action,
          payload
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to dispatch command');
      }

      const newCmd = await res.json();
      // Add new command to local history top
      setHistory((prev) => [newCmd, ...prev]);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    dispatchCommand('rename', { new_name: newName });
    setShowRenameModal(false);
    setNewName('');
  };

  const handleNotify = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    dispatchCommand('notify', { message });
    setShowNotifyModal(false);
    setMessage('');
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <span className="spinner" style={{ width: '40px', height: '40px' }} />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="page-container">
        <button className="btn-back" onClick={() => navigate('/')}>← Back to Dashboard</button>
        <div className="glass-card empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3>Device Error</h3>
          <p>{error || 'Device not found'}</p>
        </div>
      </div>
    );
  }

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'online';
      case 'offline': return 'offline';
      default: return 'unreachable';
    }
  };

  return (
    <div className="page-container fade-in">
      <button className="btn-back" onClick={() => navigate('/')}>← Back to Dashboard</button>

      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">{device.name}</h1>
          <p className="page-subtitle">Hostname: {device.hostname} • OS: {device.os}</p>
        </div>
        <span className={`status-badge ${getStatusClass(device.status)}`}>
          <span className={`status-dot ${getStatusClass(device.status)}`} />
          {device.status}
        </span>
      </header>

      {/* Grid: Left: Telemetry, Right: Commands */}
      <div className="detail-grid">
        {/* Telemetry metrics details */}
        <div className="glass-card detail-section">
          <h3 className="detail-section-title">System Metrics</h3>

          <div className="detail-row">
            <span className="detail-label">CPU Usage</span>
            <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {device.cpu_usage != null ? `${Math.round(device.cpu_usage)}%` : 'N/A'}
              <span className={`status-dot ${device.cpu_usage > 80 ? 'offline' : device.cpu_usage > 50 ? 'unreachable' : 'online'}`} style={{ animation: 'none' }} />
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">RAM Usage</span>
            <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {device.ram_usage != null ? `${Math.round(device.ram_usage)}%` : 'N/A'}
              <span className={`status-dot ${device.ram_usage > 80 ? 'offline' : device.ram_usage > 50 ? 'unreachable' : 'online'}`} style={{ animation: 'none' }} />
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">CPU Cores</span>
            <span className="detail-value">{device.cpu_cores || 'N/A'} Cores</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Total RAM</span>
            <span className="detail-value">{device.ram_total_gb || 'N/A'} GB</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">IP Address</span>
            <span className="detail-value" style={{ fontFamily: 'monospace' }}>{device.ip_address || 'N/A'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Last Seen</span>
            <span className="detail-value">
              {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Registered At</span>
            <span className="detail-value">
              {device.registered_at ? new Date(device.registered_at).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>

        {/* Command execution actions */}
        <div className="glass-card detail-section">
          <h3 className="detail-section-title">Dispatch Command</h3>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Issue actions directly to this endpoint. The agent will execute them simulated and report back.
          </p>

          <div className="command-actions">
            <button 
              className="btn-action restart" 
              onClick={() => dispatchCommand('restart')} 
              disabled={actionLoading || device.status !== 'online'}
            >
              🔄 Restart
            </button>
            <button 
              className="btn-action lock" 
              onClick={() => dispatchCommand('lock')} 
              disabled={actionLoading || device.status !== 'online'}
            >
              🔒 Lock Screen
            </button>
            <button 
              className="btn-action rename" 
              onClick={() => setShowRenameModal(true)} 
              disabled={actionLoading || device.status !== 'online'}
            >
              📝 Rename
            </button>
            <button 
              className="btn-action notify" 
              onClick={() => setShowNotifyModal(true)} 
              disabled={actionLoading || device.status !== 'online'}
            >
              🔔 Notify User
            </button>
          </div>

          {device.status !== 'online' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--status-offline)', marginTop: '8px' }}>
              ⚠️ Commands can only be dispatched to online devices.
            </div>
          )}
        </div>
      </div>

      {/* History of commands */}
      <div className="command-history">
        <h2 className="page-title" style={{ fontSize: '1.25rem', marginTop: '32px', marginBottom: '16px' }}>Command Log</h2>
        {history.length === 0 ? (
          <div className="glass-card empty-state" style={{ padding: '24px' }}>
            <p className="empty-state-text">No commands have been issued to this device yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Payload</th>
                  <th>Result</th>
                  <th>Issued At</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((cmd) => (
                  <tr key={cmd.id}>
                    <td style={{ fontWeight: 600 }}>{cmd.action.toUpperCase()}</td>
                    <td>
                      <span className={`status-pill ${cmd.status}`}>
                        {cmd.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {cmd.payload && Object.keys(cmd.payload).length > 0 
                        ? JSON.stringify(cmd.payload) 
                        : '-'}
                    </td>
                    <td>{cmd.result || '-'}</td>
                    <td>{new Date(cmd.issued_at).toLocaleString()}</td>
                    <td>{cmd.completed_at ? new Date(cmd.completed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Rename Device</h3>
            <form onSubmit={handleRename}>
              <div className="form-group">
                <label className="form-label">New Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. workspace-pc"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowRenameModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Send Notification</h3>
            <form onSubmit={handleNotify}>
              <div className="form-group">
                <label className="form-label">Message</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. System update starting in 5 minutes"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNotifyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
