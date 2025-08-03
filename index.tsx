
import React from 'react';
import ReactDOM from 'react-dom/client';
// RESTORED: Back to main app with CSS support
import App from './App';
import './index.css'; // Our new CSS file
// import MinimalApp from './MinimalApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);