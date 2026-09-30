import React from 'react'

type PillTone = 'default' | 't1' | 't2' | 't3'

interface PillProps extends React.HTMLAttributes<HTMLElement> {
  tone?: PillTone
  active?: boolean
  /** Trailing count badge, e.g. "T1 (57)". */
  count?: number
  /** Supplied for interactive (filter) pills; omitted for read-only badges. */
  onClick?: React.MouseEventHandler<HTMLElement>
}

export default function Pill({
  tone = 'default',
  active = false,
  count,
  className,
  children,
  onClick,
  ...props
}: PillProps) {
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
        className={classes}
        aria-pressed={active}
        onClick={onClick}
        {...props}
      >
        {content}
      </button>
    )
  }

  return <span className={classes} {...props}>{content}</span>
}
