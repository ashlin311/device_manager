import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth, API_BASE } from './AuthContext';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [commands, setCommands] = useState({}); // Keyed by command_id or device_id? Let's keep a history or mapping
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Fetch initial device list when logged in
  useEffect(() => {
    if (!token) {
      setDevices([]);
      return;
    }

    const fetchDevices = async () => {
      try {
        const res = await fetch(`${API_BASE}/devices`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (err) {
        console.error('Failed to fetch devices:', err);
      }
    };

    fetchDevices();
  }, [token]);

  // Connect WebSocket when token is available
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
      }
      setConnected(false);
      return;
    }

    let reconnectTimeout;
    const connect = () => {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Use localhost:8000 for backend ws
      const wsUrl = `ws://localhost:8000/ws/admin`;

      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket Connected');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          if (message.type === 'device_update') {
            const updatedDevice = message.device;
            setDevices((prevDevices) => {
              const index = prevDevices.findIndex((d) => d.id === updatedDevice.id);
              if (index > -1) {
                const newDevices = [...prevDevices];
                newDevices[index] = updatedDevice;
                return newDevices;
              } else {
                return [...prevDevices, updatedDevice];
              }
            });
          } else if (message.type === 'command_update') {
            const updatedCommand = message.command;
            setCommands((prevCommands) => ({
              ...prevCommands,
              [updatedCommand.id]: updatedCommand
            }));
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket Closed. Attempting reconnect in 3s...');
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [token]);

  const value = {
    devices,
    commands,
    connected,
    setDevices,
    setCommands
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
