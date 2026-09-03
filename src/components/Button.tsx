import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'success'
  size?: 'default' | 'sm'
  danger?: boolean
}

export default function Button({
  variant = 'default',
  size = 'default',
  danger = false,
  className,
  style,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size !== 'default' && `btn-${size}`,
    className
  ].filter(Boolean).join(' ')

  const dangerStyle = danger ? { ...style, color: 'var(--t1)' } : style

  return (
    <button className={classes} style={dangerStyle} {...props} />
  )
}
