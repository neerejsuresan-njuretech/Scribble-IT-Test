import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDesktopBridge } from './desktop/desktopBridge';

async function bootstrap() {
  await initializeDesktopBridge().catch(() => undefined);
  createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();
