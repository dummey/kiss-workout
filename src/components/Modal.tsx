import React, { useRef, useCallback } from 'react'
import Button from './Button'

export interface ModalAction {
  label: string
  value: string | null
  variant?: 'default' | 'primary' | 'success' | 'danger'
}

export interface ModalProps {
  isOpen: boolean
  title: string
  message?: string
  input?: {
    defaultValue?: string
    placeholder?: string
  }
  actions: ModalAction[]
  onClose: () => void
  onAction: (value: string | null, inputValue?: string) => void
}

export default function Modal({
  isOpen,
  title,
  message,
  input,
  actions,
  onClose,
  onAction
}: ModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const getInputValue = useCallback(() => {
    return inputRef.current?.value ?? ''
  }, [])

  if (!isOpen) return null

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {message && <p className="modal-sub">{message}</p>}
        {input && (
          <div className="form-group">
            <input
              ref={inputRef}
              type="text"
              defaultValue={input.defaultValue}
              placeholder={input.placeholder}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onAction('confirm', getInputValue())
                }
              }}
            />
          </div>
        )}
        <div className="modal-actions">
          {actions.map(action => (
            <Button
              key={action.label}
              variant={action.variant || 'default'}
              onClick={() => {
                onAction(action.value, input ? getInputValue() : undefined)
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
