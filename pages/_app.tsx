import '../styles/globals.css';
import 'leaflet/dist/leaflet.css'; // Add this line for Leaflet CSS
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LoadingProvider, useLoading } from '../contexts/LoadingContext';
import loadingStyles from '../styles/LoadingIndicator.module.css';

const WebSocketProvider = dynamic(() => import('../contexts/WebSocketContext').then(mod => mod.WebSocketProvider), {
  ssr: false,
});

const LoadingIndicator = () => {
  const { isLoading } = useLoading();
  if (!isLoading) return null;

  return (
    <div className={loadingStyles.loadingIndicator}>
      読み込み中...
    </div>
  );
};

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <WebSocketProvider>
          <Component {...pageProps} />
        </WebSocketProvider>
        <LoadingIndicator />
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default MyApp;