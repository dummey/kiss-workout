import React from 'react'
import { createRoot } from 'react-dom/client'
import { TrackerProvider } from './context'
import { BackupProvider } from './context/BackupContext'
import { ModalProvider } from './components/ModalProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BackupProvider>
        <TrackerProvider>
          <ModalProvider>
            <App />
          </ModalProvider>
        </TrackerProvider>
      </BackupProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
