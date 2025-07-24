import React, { useEffect, useContext, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import Cookies from 'js-cookie'; // Import js-cookie
import styles from './Map.module.css';
import { ThemeContext } from '../contexts/ThemeContext';
import { EEWData } from '../types/p2pquake';
import { useLoading } from '../contexts/LoadingContext';

const customMarkerIcon = new L.Icon({
  iconUrl: '/marker.png',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

const eewEpicenterIcon = new L.Icon({
  iconUrl: '/globe.svg', // 긴급지진속보 진원지 아이콘
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const getMagnitudeIcon = (scale: number) => {
  let iconFileName: string;
  if (scale === 10) iconFileName = '1.png';
  else if (scale === 20) iconFileName = '2.png';
  else if (scale === 30) iconFileName = '3.png';
  else if (scale === 40) iconFileName = '4.png';
  else if (scale === 45) iconFileName = '5-.png';
  else if (scale === 50) iconFileName = '5+.png';
  else if (scale === 55) iconFileName = '6-.png';
  else if (scale === 60) iconFileName = '6+.png';
  else if (scale === 70) iconFileName = '7.png';
  else iconFileName = '1.png'; // Default or fallback icon

  return new L.Icon({
    iconUrl: `/UI/magnitude/magnitude/${iconFileName}`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

interface Earthquake {
  time: string;
  location: string;
  depth: number;
  magnitude: number;
  intensity: number;
  latitude: number | null;
  longitude: number | null;
}

interface Point {
  addr: string;
  isArea: boolean;
  pref: string;
  scale: number;
}

interface MapProps {
  earthquake: {
    intensity: number;
    magnitude: number;
    depth: number;
    location: string;
    tsunamiWarning: 'none' | 'watch' | 'warning' | 'major_warning';
    recentEarthquakes: Earthquake[];
    latitude: number | null;
    longitude: number | null;
  };
  eewData: EEWData | null; // 긴급지진속보 데이터 추가
  points?: Point[];
}

const MapUpdater: React.FC<{ position: [number, number] | null; eewPosition: [number, number] | null }> = ({ position, eewPosition }) => {
  const map = useMap();
  useEffect(() => {
    if (eewPosition) {
      map.setView(eewPosition, 8);
    } else if (position) {
      map.setView(position, 10);
    }
  }, [position, eewPosition, map]);
  return null;
};

const Map: React.FC<MapProps> = ({ earthquake, eewData, points = [] }) => {
  const { theme } = useContext(ThemeContext);
  const { setIsLoading } = useLoading();


  // 지도에 표시할 주소 마커 좌표 상태
  const [pointCoords, setPointCoords] = useState<{ addr: string; lat: number; lng: number; pref: string; scale: number }[]>([]);

  // 지도 중심 좌표
  const defaultPosition: [number, number] = [35.6895, 139.6917];
  // 메인 지진 마커 좌표
  const earthquakePosition: [number, number] | null =
    earthquake.latitude && earthquake.longitude
      ? [earthquake.latitude, earthquake.longitude]
      : null;
  // EEW 진원지 마커 좌표
  const eewEpicenterPosition: [number, number] | null =
    eewData && eewData.latitude && eewData.longitude
      ? [eewData.latitude, eewData.longitude]
      : null;

  const pointsString = JSON.stringify(points);

  // 주소를 좌표로 변환해서 마커로 표시
  useEffect(() => {
    let isMounted = true;

    const cleanAddress = (addr: string, pref: string): string => {
      let cleaned = addr;
      // Remove prefecture name from the beginning of the address if it's redundant
      if (cleaned.startsWith(pref)) {
        cleaned = cleaned.substring(pref.length).trim();
      } else if (pref.endsWith('県') || pref.endsWith('都') || pref.endsWith('道') || pref.endsWith('府')) {
        const shortPref = pref.substring(0, pref.length - 1);
        if (cleaned.startsWith(shortPref)) {
          cleaned = cleaned.substring(shortPref.length).trim();
        }
      }
      return cleaned;
    };

    const fetchWithDelay = async (pt: Point, delay: number): Promise<{ addr: string; lat: number; lng: number; pref: string; scale: number } | null> => {
      return new Promise(resolve => setTimeout(async () => {
        const cleanedAddr = cleanAddress(pt.addr, pt.pref);
        const cookieKey = `geocode_${cleanedAddr}`;
        const cachedData = Cookies.get(cookieKey);

        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            console.log(`Using cached geocode for ${pt.addr} (cleaned to ${cleanedAddr})`);
            resolve({ addr: pt.addr, lat: parsedData.lat, lng: parsedData.lng, pref: pt.pref, scale: pt.scale });
            return;
          } catch (e) {
            console.error(`Error parsing cached data for ${pt.addr}:`, e);
            Cookies.remove(cookieKey); // Remove corrupted cache
          }
        }

        try {
          const OPENCAGE_API_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
          if (!OPENCAGE_API_KEY) {
            console.error("OpenCage API key is not defined. Please set NEXT_PUBLIC_OPENCAGE_API_KEY in your .env.local file.");
            resolve(null);
            return;
          }

          const query = encodeURIComponent(cleanedAddr);

          const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${OPENCAGE_API_KEY}&language=ja&countrycode=jp&limit=1`);
          if (!res.ok) { // Check for non-200 responses
            console.error(`OpenCage API error for ${pt.addr} (cleaned to ${cleanedAddr}): ${res.statusText}`);
            resolve(null);
            return;
          }
          const data = await res.json();
          console.log(`OpenCage API response for ${pt.addr} (cleaned to ${cleanedAddr}):`, data);
          if (data && data.results && data.results.length > 0) {
            const lat = parseFloat(data.results[0].geometry.lat);
            const lng = parseFloat(data.results[0].geometry.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              const result = { addr: pt.addr, lat: lat, lng: lng, pref: pt.pref, scale: pt.scale };
              Cookies.set(cookieKey, JSON.stringify({ lat, lng }), { expires: 7 }); // Cache for 7 days
              resolve(result);
            } else {
              console.error(`OpenCage API returned invalid coordinates for ${pt.addr} (cleaned to ${cleanedAddr}): lat=${data.results[0].geometry.lat}, lng=${data.results[0].geometry.lng}`, data);
              resolve(null);
            }
          } else {
            console.error(`OpenCage API did not return results for ${pt.addr} (cleaned to ${cleanedAddr})`, data);
            resolve(null);
          }
        } catch (e) {
          console.error(`Error fetching geocode for ${pt.addr} (cleaned to ${cleanedAddr}):`, e);
          resolve(null);
        }
      }, delay));
    };

    async function fetchCoords() {
      const currentPoints = JSON.parse(pointsString);
      if (!currentPoints || currentPoints.length === 0) {
        setPointCoords([]);
        setIsLoading(false); // No points to fetch, so not loading
        return;
      }
      
      setIsLoading(true); // Start loading

      // 각 주소에 대해 API 요청을 생성합니다.
      const promises = currentPoints.map((pt: Point, index: number) => fetchWithDelay(pt, index * 1100)); // 1.1초 간격으로 요청
      const results = await Promise.all(promises);
      
      // null이 아닌 유효한 결과만 필터링합니다.
      const validResults = results.filter(r => r !== null) as { addr: string; lat: number; lng: number; pref: string; scale: number }[];
      
      if (isMounted) {
        setPointCoords(currentCoords => {
          // Check if the new coordinates are different from the current ones
          if (JSON.stringify(currentCoords) !== JSON.stringify(validResults)) {
            return validResults;
          }
          return currentCoords;
        });
      }
      setIsLoading(false); // End loading
    }

    fetchCoords();

    return () => {
      isMounted = false;
    };
  }, [pointsString]);

  const lightMapUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const lightMapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const darkMapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const currentMapUrl = theme === 'light' ? lightMapUrl : darkMapUrl;
  const currentMapAttribution = theme === 'light' ? lightMapAttribution : darkMapAttribution;

  return (
    <MapContainer center={defaultPosition} zoom={5} className={styles.mapContainer}>
      <TileLayer
        url={currentMapUrl}
        attribution={currentMapAttribution}
      />
      <MapUpdater position={earthquakePosition} eewPosition={eewEpicenterPosition} />

      {/* Main earthquake marker */}
      {earthquakePosition && (
        <Marker
          position={earthquakePosition}
          icon={customMarkerIcon}
        />
      )}

      {/* Points 마커 (leaflet 기본 마커) */}
      {pointCoords.map((pt, idx) => (
        <Marker key={idx} position={[pt.lat, pt.lng]} icon={getMagnitudeIcon(pt.scale)}>
          <Tooltip direction="top" offset={[0, -30]} opacity={1} permanent={false}>
            <div>
              <strong>{pt.addr}</strong><br />
              {pt.pref} / scale: {pt.scale}
            </div>
          </Tooltip>
        </Marker>
      ))}


      {/* EEW Epicenter Marker and Circles */}
      {eewEpicenterPosition && (
        <>
          <Marker position={eewEpicenterPosition} icon={eewEpicenterIcon} />
          {/* P-wave and S-wave concentric circles (example radii) */}
        </>
      )}
    </MapContainer>
  );
}

export default Map;