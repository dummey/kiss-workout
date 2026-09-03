import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Button from '../components/Button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByText('Click me')
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('btn')
    expect(btn.className).not.toContain('btn-primary')
    expect(btn.className).not.toContain('btn-success')
  })

  it('renders with primary variant', () => {
    render(<Button variant="primary">Primary</Button>)
    const btn = screen.getByText('Primary')
    expect(btn.className).toContain('btn-primary')
  })

  it('renders with success variant', () => {
    render(<Button variant="success">Success</Button>)
    const btn = screen.getByText('Success')
    expect(btn.className).toContain('btn-success')
  })

  it('renders with small size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByText('Small')
    expect(btn.className).toContain('btn-sm')
  })

  it('renders with danger style', () => {
    render(<Button danger>Danger</Button>)
    const btn = screen.getByText('Danger')
    expect(btn.style.color).toBe('var(--t1)')
  })

  it('passes through disabled prop', () => {
    render(<Button disabled>Disabled</Button>)
    const btn = screen.getByText('Disabled') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('merges custom className', () => {
    render(<Button className="custom">Custom</Button>)
    const btn = screen.getByText('Custom')
    expect(btn.className).toContain('custom')
    expect(btn.className).toContain('btn')
  })

  it('passes through onClick handler', () => {
    let clicked = false
    render(<Button onClick={() => { clicked = true }}>Click</Button>)
    const btn = screen.getByText('Click')
    btn.click()
    expect(clicked).toBe(true)
  })
})
