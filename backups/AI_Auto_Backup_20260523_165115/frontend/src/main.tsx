import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { GlobalDataProvider } from './lib/context/GlobalDataContext'
import './index.css'

// Remove the pre-hydration loader once React takes over
const preLoader = document.getElementById('pre-loader');
if (preLoader) preLoader.remove();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalDataProvider>
      <App />
    </GlobalDataProvider>
  </React.StrictMode>,
)
