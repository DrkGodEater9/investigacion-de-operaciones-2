import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/app/App.jsx';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-500.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import '@fontsource/stix-two-text/latin-400.css';
import '@fontsource/stix-two-text/latin-400-italic.css';
import '@fontsource/stix-two-text/latin-600.css';
import '@fontsource/stix-two-text/greek-400.css';
import '@fontsource/stix-two-text/greek-400-italic.css';
import '@fontsource/stix-two-text/greek-600.css';
import '@/styles/base.css';
import '@/styles/layout.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
