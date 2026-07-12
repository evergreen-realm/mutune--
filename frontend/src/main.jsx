import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './lib/sentry';
import posthog from 'posthog-js';

initSentry();

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
