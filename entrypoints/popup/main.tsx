import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { PopupErrorBoundary } from './PopupErrorBoundary';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupErrorBoundary>
      <App />
    </PopupErrorBoundary>
  </React.StrictMode>,
);
