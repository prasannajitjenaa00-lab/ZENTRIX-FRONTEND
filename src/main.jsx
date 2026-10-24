import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/styles.css';
import './styles/assigned-audio.css';
import './styles/employee-dashboard.css';
import './styles/landing.css';
import App from './App';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
