import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Tab visibility handler - reloads page when returning from hidden tab
import '@/lib/utils/tab-visibility-handler';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
