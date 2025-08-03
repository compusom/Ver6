import React from 'react'
import ReactDOM from 'react-dom/client'
import MinimalApp from './MinimalApp.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MinimalApp />
  </React.StrictMode>,
)
