import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';

export default function AuditLog() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/audit/logs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        const data = await res.json();
        setLogs(data);
      } catch (err) {
        setError(err.message || 'Error loading logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [token]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <span className="spinner" style={{ width: '40px', height: '40px' }} />
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">Track administrative tasks, actions, and login activities</p>
      </header>

      {error ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3>Failed to Load Logs</h3>
          <p>{error}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No Log History</h3>
          <p className="empty-state-text">Administration operations will appear here as they occur.</p>
        </div>
      ) : (
        <div className="audit-table-container table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User ID</th>
                <th>Target Device</th>
                <th>Operation</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {log.user_id}
                  </td>
                  <td>
                    {log.device_id ? (
                      <Link to={`/devices/${log.device_id}`} style={{ fontWeight: 500 }}>
                        {log.device_id.substring(0, 8)}...
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Global</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{
                      color: log.action.includes('fail') ? 'var(--status-offline)' : 
                             log.action.includes('complete') ? 'var(--status-online)' : 'var(--text-primary)'
                    }}>
                      {log.action.toUpperCase()}
                    </span>
                  </td>
                  <td>{log.detail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
