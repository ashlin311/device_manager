import React, { useState } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';

export default function CommandBar({ onCommandSuccess }) {
  const { token } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/commands/natural`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        throw new Error('LLM command invocation failed');
      }

      const data = await res.json();
      if (data.error) {
        setResult({ type: 'error', message: data.error });
      } else {
        setResult({
          type: 'success',
          message: `Successfully executed: ${data.action.toUpperCase()} action on ${data.targets.length} target device(s).`,
          details: data
        });
        setPrompt('');
        if (onCommandSuccess) {
          onCommandSuccess();
        }
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message || 'Error processing request' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="command-bar">
      <form onSubmit={handleSubmit} className="command-bar-inner">
        <input
          type="text"
          className="command-input"
          placeholder="e.g., Restart all online windows machines, or rename machine ashlin-vm1 to vm-work..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-command" disabled={loading || !prompt.trim()}>
          {loading ? (
            <>
              <span className="spinner" style={{ width: '12px', height: '12px' }} />
              Parsing Intent...
            </>
          ) : (
            <>
              <span>✨</span> Run Command
            </>
          )}
        </button>
      </form>

      {result && (
        <div className={`command-result fade-in ${result.type === 'error' ? 'error' : 'success'}`}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {result.type === 'error' ? '❌ Command Parsing Failed' : '✅ Command Executed'}
          </div>
          <div>{result.message}</div>
          {result.details && result.details.payload && Object.keys(result.details.payload).length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.75rem', fontFamily: 'monospace', opacity: 0.8 }}>
              Payload: {JSON.stringify(result.details.payload)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
