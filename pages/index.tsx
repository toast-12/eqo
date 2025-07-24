import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { EarthquakeData } from '../types/p2pquake';

const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});
import styles from '../styles/Home.module.css';
import { useWebSocket } from '../contexts/WebSocketContext';

import Sidebar from '../components/Sidebar';

declare global {
  interface Window {
    triggerEarthquake: () => void;
  }
}

interface Earthquake {
  time: string;
  location: string;
  depth: number;
  magnitude: number;
  intensity: number;
  latitude: number | null;
  longitude: number | null;
  points?: { addr: string; isArea: boolean; pref: string; scale: number }[];
}

// This interface might need adjustment based on the actual API data structure
interface TransformedData {
  intensity: number;
  magnitude: number;
  depth: number;
  location: string;
  tsunamiWarning: 'none' | 'watch' | 'warning' | 'major_warning';
  recentEarthquakes: Earthquake[];
  latitude: number | null;
  longitude: number | null;
  points?: { addr: string; isArea: boolean; pref: string; scale: number }[];
}

const Home = () => {
  const webSocketContext = useWebSocket();
  const earthquakeData = webSocketContext ? webSocketContext.earthquakeData : [];
  const eewData = webSocketContext ? webSocketContext.eewData : null;
  const simulateEEW = webSocketContext ? webSocketContext.simulateEEW : () => {};

  // Function to transform the raw WebSocket data into the format Sidebar expects
  const transformData = (data: EarthquakeData | null): TransformedData => {
    if (!data || data.code !== 551) { // 551 is for earthquake info
      return {
        intensity: 0,
        magnitude: 0,
        depth: 0,
        location: '',
        tsunamiWarning: 'none',
        recentEarthquakes: [],
        latitude: null,
        longitude: null,
      };
    }

    const earthquake = data.earthquake || {};
    const hypocenter = earthquake.hypocenter || {};

    const intensity = earthquake.maxScale || 0;
    const magnitude = hypocenter.magnitude || 0;
    const depth = hypocenter.depth || 0;
    const location = hypocenter.name || '';
    const latitude = hypocenter.latitude || null;
    const longitude = hypocenter.longitude || null;
    const domesticTsunami = earthquake.domesticTsunami || 'None';

    let tsunamiWarning: TransformedData['tsunamiWarning'] = 'none';
    if (domesticTsunami === 'Warning') {
      tsunamiWarning = 'warning';
    } else if (domesticTsunami === 'Watch') {
      tsunamiWarning = 'watch';
    }

    const points = data && 'points' in data ? data.points : [];
    return { intensity, magnitude, depth, location, tsunamiWarning, recentEarthquakes: [], latitude, longitude, points };
  };

  const latestEarthquakeData = earthquakeData ? earthquakeData.find(item => item.code === 551) || null : null;
  const initialSidebarData = transformData(latestEarthquakeData);

  const [displayedEarthquakeData, setDisplayedEarthquakeData] = useState<TransformedData>(initialSidebarData);
  const [isTemporaryDisplay, setIsTemporaryDisplay] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  const handleEewClose = () => {
    if (simulateEEW) {
      simulateEEW(null); // simulateEEW 함수를 사용하여 EEW 데이터를 null로 설정하여 UI 숨김
    }
  };

  const convertIntensityToSpeechString = (intensityValue: number): string => {
    switch (intensityValue) {
      case 10: return '1';
      case 20: return '2';
      case 30: return '3';
      case 40: return '4';
      case 45: return '5弱';
      case 50: return '5強';
      case 55: return '6弱';
      case 60: return '6強';
      case 70: return '7';
      default: return '情報なし';
    }
  };

  

  useEffect(() => {
    window.triggerEarthquake = () => {
      // This functionality is removed as per the edit hint.
      // setIsModalOpen(true);
    };

    return () => {
      window.triggerEarthquake = () => {};
    }
  }, []);

  // Update displayed data when latest earthquake data changes, unless a temporary display is active
  useEffect(() => {
    if (!isTemporaryDisplay) {
      const points = latestEarthquakeData && 'points' in latestEarthquakeData
        ? latestEarthquakeData.points
        : [];
      console.log("Updating displayed data. Points:", points);
      setDisplayedEarthquakeData(transformData(latestEarthquakeData));
    }

    // TTS Announcement
    const storedLastAnnouncedEarthquakeTime = localStorage.getItem('lastAnnouncedEarthquakeTime');
    if (latestEarthquakeData && latestEarthquakeData.time !== storedLastAnnouncedEarthquakeTime) {
      console.log("Announcing new earthquake via TTS:", latestEarthquakeData.time);
      const earthquake = latestEarthquakeData.earthquake || {};
      const hypocenter = earthquake.hypocenter || {};

      const intensity = earthquake.maxScale || 0;
      const magnitude = hypocenter.magnitude || 0;
      const location = hypocenter.name || '不明';
      const domesticTsunami = earthquake.domesticTsunami || 'None';

      const freeFormComment = latestEarthquakeData.comments?.freeFormComment || '';

      let tsunamiMessage = '';
      if (domesticTsunami === 'Warning') {
        tsunamiMessage = '津波警報が発表されています。';
      } else if (domesticTsunami === 'Watch') {
        tsunamiMessage = '津波注意報が発表されています。';
      } else if (domesticTsunami === 'MajorWarning') {
        tsunamiMessage = '大津波警報が発表されています。';
      } else if (domesticTsunami === 'None') {
        tsunamiMessage = '津波の心配はありません。';
      }

      const commentText = freeFormComment ? `特異事項および伝達事項が届きました。内容は次のとおりです。 ${freeFormComment}` : '';
      const speechText = `地震情報。最大震度${convertIntensityToSpeechString(intensity)}の地震が発生しました。規模はマグニチュード${magnitude.toFixed(1)}、震源地は${location}です。${tsunamiMessage} ${commentText}`;

      if ('speechSynthesis' in window) {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.2;
        audio.play().catch(e => console.error("Error playing sound:", e));

        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          const utterance = new SpeechSynthesisUtterance(speechText);
          utterance.lang = 'ja-JP'; // Set language to Japanese
          window.speechSynthesis.speak(utterance);
        }, 1500);
      } else {
        console.warn("Browser does not support Web Speech API for TTS.");
      }
      localStorage.setItem('lastAnnouncedEarthquakeTime', latestEarthquakeData.time);

      
    }
  }, [latestEarthquakeData, isTemporaryDisplay]);

  // Filter and map recent earthquake messages from the rawDataArray
  const recentEarthquakes = (earthquakeData || [])
    .filter((msg): msg is EarthquakeData => msg.code === 551) // Only earthquake info messages
    .map(msg => ({
      time: msg.time,
      location: msg.earthquake.hypocenter.name,
      depth: msg.earthquake.hypocenter.depth || 0,
      magnitude: msg.earthquake.hypocenter.magnitude || 0,
      intensity: msg.earthquake.maxScale || 0,
      latitude: msg.earthquake.hypocenter.latitude,
      longitude: msg.earthquake.hypocenter.longitude,
      points: msg.points || [],
    }))
    .slice(0, 30); // Show only the latest 30

  const handleEarthquakeClick = (earthquake: Earthquake) => {
    // Clear any existing timer
    if (timerId) {
      clearInterval(timerId);
    }

    // Set the clicked earthquake data for display
    setDisplayedEarthquakeData({
      intensity: earthquake.intensity,
      magnitude: earthquake.magnitude,
      depth: earthquake.depth,
      location: earthquake.location,
      tsunamiWarning: 'none', // Assuming temporary display doesn't change tsunami warning
      recentEarthquakes: [], // Don't show recent earthquakes in temporary display
      latitude: earthquake.latitude,
      longitude: earthquake.longitude,
      points: earthquake.points || [],
    });
    setIsTemporaryDisplay(true);
    setRemainingTime(15);

    const newTimerId = setInterval(() => {
      setRemainingTime(prevTime => {
        if (prevTime <= 1) {
          clearInterval(newTimerId);
          setIsTemporaryDisplay(false);
          setDisplayedEarthquakeData(transformData(latestEarthquakeData)); // Revert to latest
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    setTimerId(newTimerId);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>EQO</title>
        <meta name="description" content="Earthquake and Tsunami Information" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <Sidebar
          {...displayedEarthquakeData}
          freeFormComment={latestEarthquakeData?.comments?.freeFormComment}
          recentEarthquakes={recentEarthquakes}
          onEarthquakeClick={handleEarthquakeClick}
          isTemporaryDisplay={isTemporaryDisplay}
          remainingTime={remainingTime}
          eewData={eewData}
          onEewClose={handleEewClose}
        />
                <Map key="earthquake-map" earthquake={displayedEarthquakeData} eewData={eewData} points={displayedEarthquakeData.points} />
      </main>
    </div>
  );
};

export default Home;
