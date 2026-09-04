import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <div style={{ marginBottom: 32 }}>
          <img src={logo} alt="KISS Workout Tracker" style={{ width: '100%', height: 'auto' }} />
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
        </NavLink>
      </nav>

      <main style={{ flex: 1, padding: 32 }}>
        <Outlet />
      </main>
    </div>
  )
}
