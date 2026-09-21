import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SessionsPage from './pages/SessionsPage'
import ExercisesPage from './pages/ExercisesPage'
import SessionDetailPage from './pages/SessionDetailPage'
import WorkoutsPage from './pages/WorkoutsPage'
import SettingsPage from './pages/SettingsPage'
import { ModalProvider } from './components/ModalProvider'

export default function App() {
  return (
    <BrowserRouter>
      <ModalProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/sessions" replace />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:date" element={<SessionDetailPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="workouts" element={<WorkoutsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ModalProvider>
    </BrowserRouter>
  )
}
