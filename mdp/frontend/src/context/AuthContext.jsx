import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_BASE = 'http://localhost:8000';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("token")
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Attempt to fetch user if token changes
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!res.ok) {
      const errorData = await res.json();
      setLoading(false);
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
  };

  const register = async (email, password) => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const errorData = await res.json();
      setLoading(false);
      throw new Error(errorData.detail || 'Registration failed');
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    loading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
