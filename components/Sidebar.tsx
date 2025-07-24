import React, { useState, useEffect, useContext } from 'react';
import styles from './Sidebar.module.css';
import { Activity, Clock, Moon, Sun, AlertTriangle } from 'lucide-react'; // Import icons from lucide-react
import { ThemeContext } from '../contexts/ThemeContext';
import { EEWData } from '../types/p2pquake';

interface Earthquake {
  time: string;
  location: string;
  depth: number;
  magnitude: number;
  intensity: number;
  latitude: number | null;
  longitude: number | null;
}

interface SidebarProps {
  intensity: number;
  magnitude: number;
  depth: number;
  location: string;
  tsunamiWarning: 'none' | 'watch' | 'warning' | 'major_warning';
  freeFormComment: string | undefined;
  recentEarthquakes: Earthquake[];
  onEarthquakeClick: (earthquake: Earthquake) => void;
  isTemporaryDisplay: boolean;
  remainingTime: number;
  eewData: EEWData | null; // EEW 데이터 추가
  onEewClose: () => void; // EEW 닫기 함수 추가
}

const Sidebar: React.FC<SidebarProps> = ({
  intensity,
  magnitude,
  depth,
  location,
  tsunamiWarning,
  freeFormComment,
  recentEarthquakes,
  onEarthquakeClick,
  isTemporaryDisplay,
  remainingTime,
  eewData,
  onEewClose,
}) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date()); // Set initial time on client
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTsunamiInfo = () => {
    switch (tsunamiWarning) {
      case 'major_warning':
        return { text: '大津波警報', className: styles.tsunamiWarning_major_warning };
      case 'warning':
        return { text: '津波警報', className: styles.tsunamiWarning_warning };
      case 'watch':
        return { text: '津波注意報', className: styles.tsunamiWarning_watch };
      default:
        return { text: '津波の心配なし', className: styles.tsunamiWarning_none };
    }
  };

  const getIntensityClassName = (intensityValue: number) => {
    if (intensityValue >= 70) return styles.intensity70;
    if (intensityValue >= 65) return styles.intensity65;
    if (intensityValue >= 60) return styles.intensity60;
    if (intensityValue >= 55) return styles.intensity55;
    if (intensityValue >= 50) return styles.intensity50;
    if (intensityValue >= 40) return styles.intensity40;
    if (intensityValue >= 30) return styles.intensity30;
    if (intensityValue >= 20) return styles.intensity20;
    if (intensityValue >= 10) return styles.intensity10;
    return '';
  };

  const convertIntensityToString = (intensityValue: number, isRecent: boolean = false): string => {
    if (intensityValue < 0) {
      return isRecent ? '?' : '情報なし';
    }
    switch (intensityValue) {
      case 10: return '1';
      case 20: return '2';
      case 30: return '3';
      case 40: return '4';
      case 45: return '5-';
      case 50: return '5+';
      case 55: return '6-';
      case 60: return '6+';
      case 70: return '7';
      default: return '?';
    }
  };

  const getMagnitudeClassName = (magnitudeValue: number) => {
    if (magnitudeValue >= 7.0) return styles.magnitude_major;
    if (magnitudeValue >= 5.0) return styles.magnitude_moderate;
    if (magnitudeValue >= 3.0) return styles.magnitude_light;
    return styles.magnitude_minor;
  };

  const getDepthClassName = (depthValue: number) => {
    if (depthValue > 0 && depthValue <= 10) return styles.depth_very_shallow;
    if (depthValue > 10 && depthValue <= 20) return styles.depth_shallow_mid;
    if (depthValue > 20 && depthValue < 30) return styles.depth_shallow;
    if (depthValue >= 30 && depthValue < 100) return styles.depth_intermediate;
    if (depthValue >= 100) return styles.depth_deep;
    return styles.depth_shallow; // Default or fallback
  };

  

  const isNormal = !location && tsunamiWarning === 'none' && !eewData;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={toggleTheme} className={styles.themeToggleButton}>
            {theme === 'light' ? <Moon size={20} color="black" /> : <Sun size={20} color="white" />}
          </button>
          <span>UTC+9</span>
        </div>
        {time && (
          <span>
            {time.getFullYear()}/{String(time.getMonth() + 1).padStart(2, '0')}/{String(time.getDate()).padStart(2, '0')} {time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {eewData ? (
        <div className={styles.infoBlock}> {/* Reusing infoBlock style for EEW */} 
          <h3 className={styles.eewTitle}>
            <AlertTriangle size={20} color="red" /> 緊急地震速報
          </h3>
          <div className={styles.eewDetails}>
            <p><strong>発生時刻:</strong> {new Date(eewData.time).toLocaleString()}</p>
            <p><strong>震源地:</strong> {eewData.region_name}</p>
            <p><strong>マグニチュード:</strong> {eewData.magnitude}</p>
            <p><strong>予想最大震度:</strong> <span className={getIntensityClassName(parseInt(eewData.forecast_max_intensity) * 10)}>{convertIntensityToString(parseInt(eewData.forecast_max_intensity) * 10)}</span></p>
            {eewData.is_training && <p className={styles.trainingMessage}>※これは訓練です</p>}
          </div>
          
          {eewData.regions && eewData.regions.length > 0 && (
            <div className={styles.eewRegionsSection}>
              <h4>主要観測点</h4>
              <ul className={styles.eewRegionsList}>
                {eewData.regions.map((region, index) => (
                  <li key={index} className={styles.eewRegionItem}>
                    <span>{region.name}</span>
                    <span className={getIntensityClassName(parseInt(region.forecast_intensity) * 10)}>{convertIntensityToString(parseInt(region.forecast_intensity) * 10)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={onEewClose} className={styles.eewCloseButton}>閉じる</button>
        </div>
      ) : isNormal ? (
        <div className={styles.normalState}>
          <div>現在特にお知らせはありません</div>
        </div>
      ) : (
        <div className={styles.infoBlock}>
          <h3>
            <Activity size={20} /> {/* Earthquake Icon */}
            地震情報
          </h3>
          <div className={styles.timestamp}>
            <Clock size={16} /> {/* Time Icon */}
            {isTemporaryDisplay && (
              <span className={styles.temporaryMessage}>
                (임시 표시: {remainingTime}초 후 복구)
              </span>
            )}
            {recentEarthquakes.length > 0 ? (
              `${new Date(recentEarthquakes[0].time).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(recentEarthquakes[0].time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            ) : (
              'N/A'
            )}
          </div>
          <div className={styles.location}>{location}</div>

          <div className={styles.mainDetails}>
            <div className={`${styles.intensity} ${intensity < 0 ? styles.noInfoBox : getIntensityClassName(intensity)}`}>
              <div className={styles.intensityTitle}>最大震度</div>
              <div className={`${styles.intensityValue} ${intensity < 0 ? styles.noInfoText : ''}`}>{intensity < 0 ? '情報なし' : convertIntensityToString(intensity)}</div>
            </div>
            <div className={`${styles.magnitude} ${magnitude < 0 ? styles.noInfoBox : getMagnitudeClassName(magnitude)}`}>
              <div className={styles.magnitudeTitle}>規模</div>
              <div className={magnitude < 0 ? styles.noInfoText : ''}>{magnitude < 0 ? '情報なし' : `M ${magnitude.toFixed(1)}`}</div>
            </div>
            <div className={`${styles.depth} ${depth < 0 ? styles.noInfoBox : getDepthClassName(depth)}`}>
              <div className={styles.depthTitle}>深さ</div>
              <div className={`${styles.depthValue} ${depth < 0 ? styles.noInfoText : ''}`}>{depth < 0 ? '情報なし' : `${depth}km`}</div>
            </div>
          </div>

          <div className={`${styles.tsunamiInfo} ${getTsunamiInfo().className}`}>
            {getTsunamiInfo().text}
          </div>
          {freeFormComment && (
            <div className={styles.freeFormComment}>
              <strong>特異事項および伝達事項</strong>
              <p>{freeFormComment}</p>
            </div>
          )}
        </div>
      )}

      {eewData && (
        <div className={styles.simplifiedEarthquakeInfo}> {/* New style for simplified info */} 
          <h4>現在の地震情報 (簡略)</h4>
          <p>震源: {location}</p>
          <p>規模: M{magnitude.toFixed(1)}</p>
          <p>最大震度: <span className={getIntensityClassName(intensity)}>{convertIntensityToString(intensity)}</span></p>
        </div>
      )}

      <div className={styles.recentEarthquakesSection}>
        <h3 className={styles.recentEarthquakesTitle}>
          <Activity size={20} /> {/* Recent Earthquakes Icon */}
          最近の地震
        </h3>
        <div className={styles.earthquakeList}>
          {recentEarthquakes.map((eq, index) => (
            <div key={index} className={styles.earthquakeItem} onClick={() => onEarthquakeClick(eq)}>
              <div className={styles.itemLeft}>
                <div className={styles.itemLocation}>{eq.location}</div>
                <div className={styles.itemDetails}>
                  {new Date(eq.time).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} {new Date(eq.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}・M{eq.magnitude.toFixed(1)}・{eq.depth}km
                </div>
              </div>
              <div className={`${styles.itemRight} ${getIntensityClassName(eq.intensity)}`}>{convertIntensityToString(eq.intensity, true)}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
