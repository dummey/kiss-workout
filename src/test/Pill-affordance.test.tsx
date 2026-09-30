import React from 'react'
import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import Pill from '../components/Pill'
// The real stylesheet. vite.config.ts sets test.css, so vitest injects it into
// jsdom rather than stubbing it, and getComputedStyle resolves the real .pill
// rules instead of a hand-copied fixture.
import '../index.css'

/**
 * Regression guard for the non-color active affordance on tier filter pills.
 *
 * The active state must be conveyed by weight + underline, not by color alone
 * (WCAG 1.4.1 Use of Color). The rule lives in src/index.css, so this test
 * loads that real file into jsdom and asserts the values off the rendered
 * element's computed style. Deleting the declarations from the CSS makes this
 * test fail — verified by mutation.
 */
afterAll(() => {
  cleanup()
})

function renderPills() {
  const { container } = render(
    <>
      <Pill tone="t1" active onClick={() => {}}>T1</Pill>
      <Pill tone="t2" onClick={() => {}}>T2</Pill>
    </>
  )
  const [active, inactive] = Array.from(container.querySelectorAll('.pill'))
  return {
    active: window.getComputedStyle(active),
    inactive: window.getComputedStyle(inactive)
  }
}

describe('Pill — non-color active affordance', () => {
  it('renders weight + underline on the active pill from the real stylesheet', () => {
    const { active } = renderPills()

    expect(active.fontWeight).toBe('700')
    // jsdom reports the shorthand; the longhand stays unset, so assert the shorthand.
    expect(active.textDecoration).toContain('underline')
  })

  it('differs from the inactive pill in weight and underline', () => {
    const { active, inactive } = renderPills()

    // Guards against a rule that sets the same values on every .pill.
    expect(inactive.fontWeight).toBe('600')
    expect(inactive.textDecoration).not.toContain('underline')
    expect(active.fontWeight).not.toBe(inactive.fontWeight)
  })
})

describe('Pill — button prop surface', () => {
  it('accepts button-only attributes alongside onClick', () => {
    // This is primarily a compile-time guard: if PillProps narrows back to
    // React.HTMLAttributes<HTMLElement>, `disabled` and `type` stop compiling
    // and `npx tsc --noEmit` fails even though this test still runs.
    const onClick = vi.fn()
    render(
      <Pill tone="t1" type="submit" disabled onClick={onClick} name="tier">
        T1
      </Pill>
    )
    const pill = screen.getByRole('button', { name: 'T1' })
    expect(pill).toBeDisabled()
    expect(pill).toHaveAttribute('type', 'submit')
  })

  it('always wins aria-pressed over a caller-supplied value', () => {
    // The component spreads {...rest} before aria-pressed, so a value the
    // caller sneaks in cannot override the state the component owns.
    render(<Pill active onClick={() => {}} aria-pressed={false}>T1</Pill>)
    expect(screen.getByRole('button', { name: 'T1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a span with no onClick', () => {
    const { container } = render(<Pill tone="t2">T2</Pill>)
    const pill = container.querySelector('.pill')!
    expect(pill.tagName).toBe('SPAN')
    expect(pill).not.toHaveAttribute('aria-pressed')
  })
})
