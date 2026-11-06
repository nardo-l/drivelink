import { name } from './config/brand';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(error => console.warn(`${name} service worker registration failed:`, error)); });

createRoot(document.getElementById('root')!).render(<App />);
