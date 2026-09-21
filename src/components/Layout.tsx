import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useBackup } from '../context/BackupContext'
import Footer from './Footer'

export default function Layout() {
  const { shouldShowReminder } = useBackup()
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <img src={logo} alt="KISS Workout Tracker" width={1024} height={1024} style={{ width: '100%', height: 'auto' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 4 }}>pre-alpha</p>
        </div>

        <NavLink to="/sessions" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Sessions
        </NavLink>
        <NavLink to="/exercises" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Exercises
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Workouts
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Settings
          {shouldShowReminder && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--t1)' }} />
          )}
        </NavLink>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <Footer />

      <nav className="bottom-tab-bar">
        <NavLink to="/sessions" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">📋</span>
          <span>Sessions</span>
        </NavLink>
        <NavLink to="/exercises" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">💪</span>
          <span>Exercises</span>
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">📊</span>
          <span>Workouts</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'tab-item' + (isActive ? ' active' : '')}>
          <span className="tab-icon">⚙️</span>
          <span>Settings</span>
          {shouldShowReminder && (
            <span className="tab-badge" />
          )}
        </NavLink>
      </nav>
    </div>
  )
}
