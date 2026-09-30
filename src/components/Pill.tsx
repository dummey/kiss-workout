import React from 'react'

type PillTone = 'default' | 't1' | 't2' | 't3'

interface PillOwnProps {
  tone?: PillTone
  active?: boolean
  /** Trailing count badge, e.g. "T1 (57)". */
  count?: number
  className?: string
  children?: React.ReactNode
}

/**
 * Interactive branch: renders a real <button>, so button-only attributes
 * (type, disabled, form, ...) are legal alongside onClick.
 * aria-pressed is owned by `active` and is deliberately not overridable.
 */
type InteractivePillProps = PillOwnProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof PillOwnProps | 'onClick' | 'aria-pressed'> & {
    /** Supplied for interactive (filter) pills. */
    onClick: React.MouseEventHandler<HTMLButtonElement>
  }

/** Read-only branch: renders a <span>, so only generic HTML attributes apply. */
type StaticPillProps = PillOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, keyof PillOwnProps> & {
    /** Omitted for read-only badges. */
    onClick?: never
  }

type PillProps = InteractivePillProps | StaticPillProps

export default function Pill({
  tone = 'default',
  active = false,
  count,
  className,
  children,
  ...props
}: PillProps) {
  const { onClick, ...rest } = props as React.HTMLAttributes<HTMLElement> & {
    onClick?: React.MouseEventHandler<HTMLElement>
  }

  const classes = [
    'pill',
    `pill-${tone}`,
    active && 'active',
    className
  ].filter(Boolean).join(' ')

  const content = count === undefined
    ? children
    : <>{children}<span className="pill-count"> ({count})</span></>

  // Interactive pills are real buttons so keyboard users get focus + activation.
  if (onClick) {
    return (
      <button
        type="button"
        {...rest}
        className={classes}
        aria-pressed={active}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return <span className={classes} {...rest}>{content}</span>
}
