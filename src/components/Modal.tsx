import React, { useRef, useCallback, createContext, useContext } from 'react'
import Button from './Button'

export interface ModalAction {
  label: string
  value: string | null
  variant?: 'default' | 'primary' | 'success' | 'danger'
}

export interface ModalControl {
  onAction: (value: string | null, inputValue?: string) => void
  onClose: () => void
}

const ModalControlContext = createContext<ModalControl>({
  onAction: () => {},
  onClose: () => {}
})

/** Access modal control callbacks from within children render-prop */
export function useModalControl() {
  return useContext(ModalControlContext)
}

type ModalChildren = React.ReactNode | ((control: ModalControl) => React.ReactNode)

export interface ModalProps {
  isOpen: boolean
  title: string
  message?: string
  input?: {
    defaultValue?: string
    placeholder?: string
  }
  actions?: ModalAction[]
  children?: ModalChildren
  onClose: () => void
  onAction: (value: string | null, inputValue?: string) => void
}

export default function Modal({
  isOpen,
  title,
  message,
  input,
  actions,
  children,
  onClose,
  onAction
}: ModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const getInputValue = useCallback(() => {
    return inputRef.current?.value ?? ''
  }, [])

  const control: ModalControl = { onAction, onClose }

  if (!isOpen) return null

  let body: React.ReactNode
  if (typeof children === 'function') {
    body = children(control)
  } else if (children) {
    body = children
  } else if (input) {
    body = (
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
    )
  } else {
    body = null
  }

  return (
    <ModalControlContext.Provider value={control}>
      <div className="modal-overlay show" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2>{title}</h2>
          {message && <p className="modal-sub">{message}</p>}
          {body}
          {actions && actions.length > 0 && (
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
          )}
        </div>
      </div>
    </ModalControlContext.Provider>
  )
}
