import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
        // Switch to login mode after successful registration
        setIsRegister(false);
        setError('Registration successful! Please login.');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">🔒</div>
        <h2 className="login-title">
          {isRegister ? 'Create Admin Account' : 'MDP Admin Login'}
        </h2>
        <p className="login-subtitle">
          {isRegister ? 'Sign up to manage endpoint devices' : 'Enter your credentials to access the console'}
        </p>

        {error && (
          <div className={`form-error ${error.includes('successful') ? 'success' : ''}`} style={{
            background: error.includes('successful') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: error.includes('successful') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: error.includes('successful') ? '#86efac' : '#fca5a5'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@mdp.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner" style={{ width: '16px', height: '16px' }} />
            ) : isRegister ? (
              'Register Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="form-toggle">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(false); setError(null); }}>
                Sign In
              </a>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(true); setError(null); }}>
                Register here
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
