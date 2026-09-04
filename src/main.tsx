import React from 'react'
import { createRoot } from 'react-dom/client'
import { TrackerProvider } from './context'
import { ModalProvider } from './components/ModalProvider'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackerProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </TrackerProvider>
  </React.StrictMode>
)
