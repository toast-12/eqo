import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { P2PQuakeData, EarthquakeData, EEWData } from '../types/p2pquake';

interface WebSocketContextType {
  earthquakeData: EarthquakeData[] | null;
  eewData: EEWData | null;
  simulateEarthquake: (earthquakeData: EarthquakeData) => void;
  simulateEEW: (eewData: EEWData | null) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [earthquakeData, setEarthquakeData] = useState<EarthquakeData[]>([]);
  const [eewData, setEewData] = useState<EEWData | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(false); // Add this ref to track mount status

  const simulateEarthquake = (data: EarthquakeData) => {
    setEarthquakeData(prevData => [data, ...prevData]);
  };

  const connectWebSocket = () => {
    if (ws.current) {
      ws.current.close(); // Close existing connection if any
    }

    ws.current = new WebSocket('wss://api.p2pquake.net/v2/ws');

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const receivedData: P2PQuakeData = JSON.parse(event.data);

        if (receivedData.code === 551) {
          console.log("Received Earthquake Data (code 551). Checking for points field:", receivedData.earthquake?.points);
          setEarthquakeData(prevData => {
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            twoDaysAgo.setHours(0, 0, 0, 0);

            const filteredPrevData = prevData.filter(item => new Date(item.time) >= twoDaysAgo);
            const updatedData = [receivedData as EarthquakeData, ...filteredPrevData];

            const latestEarthquake = updatedData.find((item: EarthquakeData) => item.code === 551);
            const storedLastPlayedSoundTime = localStorage.getItem('lastPlayedSoundTime');

            if (latestEarthquake && latestEarthquake.time !== storedLastPlayedSoundTime) {
              console.log("Playing notification sound for new earthquake:", latestEarthquake.time);
              localStorage.setItem('lastPlayedSoundTime', latestEarthquake.time);
            }

            return updatedData;
          });
        } else if (receivedData.code === 556) {
          setEewData(receivedData as EEWData);
          console.log("Received EEW Data:", receivedData);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      if (!event.wasClean && event.code !== 1000) {
        console.log('Attempting to reconnect WebSocket...');
        reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
      }
    };
  };

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const response = await fetch('https://api.p2pquake.net/v2/history?limit=100');
        const historicalData: P2PQuakeData[] = await response.json();
        if (historicalData && historicalData.length > 0) {
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 15);
          twoDaysAgo.setHours(0, 0, 0, 0);

          const filteredHistoricalData = historicalData.filter((item: P2PQuakeData) => {
            const itemDate = new Date(item.time);
            return item.code === 551 && itemDate >= twoDaysAgo;
          }) as EarthquakeData[];
          setEarthquakeData(filteredHistoricalData.slice(0, 15));
        }
      } catch (error) {
        console.error('Error fetching historical data:', error);
      }
    };

    if (!isMounted.current) {
      connectWebSocket();
      fetchHistoricalData();
      isMounted.current = true;
    }

    return () => {
      if (ws.current) {
        ws.current.close(1000, 'Component unmounted');
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const downloadEarthquakeData = () => {
      if (earthquakeData) {
        const json = JSON.stringify(earthquakeData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'earthquake_data.json';
        setTimeout(() => {
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url); // <-- 반드시 다운로드 후에 해제!
        }, 0);
      }
    };

    // 아래처럼 window에 등록만 하고, 실제 호출은 버튼 등에서만 하세요.
    (window as any).downloadEarthquakeData = downloadEarthquakeData;

    return () => {
      (window as any).downloadEarthquakeData = null;
    };
  }, [earthquakeData]);

  const simulateEEW = (data: EEWData | null) => {
    setEewData(data);
  };

  return (
    <WebSocketContext.Provider value={{ earthquakeData, eewData, simulateEarthquake, simulateEEW }}>
      {children}
    </WebSocketContext.Provider>
  );
};
