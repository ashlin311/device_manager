import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">💻</div>
        <span>MDP Admin</span>
        <span 
          className={`status-dot ${connected ? 'online' : 'offline'}`} 
          style={{ width: '8px', height: '8px', marginLeft: '8px' }}
          title={connected ? 'Connected to live stream' : 'Disconnected from stream'}
        />
      </div>
      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
          Dashboard
        </NavLink>
        <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Audit Log
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
          <span style={{ fontSize: '0.813rem', color: 'var(--text-secondary)' }}>
            {user.email}
          </span>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
