const RealMap = window.Map;
window.Map = function (...args) {
  if (!new.target) {
    console.trace('Map called WITHOUT new — args:', args);
    window.__mapMisuseTrace = new Error('trace').stack;
  }
  return new RealMap(...args);
};
window.Map.prototype = RealMap.prototype;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
