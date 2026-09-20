import React, { createContext, useContext, useState, useCallback } from 'react'
import Modal, { ModalAction, useModalControl } from './Modal'

export { useModalControl }

interface ModalState {
  isOpen: boolean
  title: string
  message?: string
  input?: {
    defaultValue?: string
    placeholder?: string
  }
  actions?: ModalAction[]
  children?: React.ReactNode | ((control: { onAction: (value: string | null, inputValue?: string) => void; onClose: () => void }) => React.ReactNode)
  resolve: ((value: { action: string | null; input?: string }) => void) | null
}

interface ModalContextValue {
  showModal: (config: {
    title: string
    message?: string
    input?: { defaultValue?: string; placeholder?: string }
    actions?: ModalAction[]
    children?: React.ReactNode | ((control: { onAction: (value: string | null, inputValue?: string) => void; onClose: () => void }) => React.ReactNode)
  }) => Promise<{ action: string | null; input?: string }>
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    actions: [],
    resolve: null
  })

  const showModal = useCallback<ModalContextValue['showModal']>((config) => {
    return new Promise((resolve) => {
      setModal(prev => {
        // If a modal is already open, resolve the previous promise as cancelled
        // so the first caller doesn't hang forever.
        if (prev.resolve) {
          prev.resolve({ action: null, input: undefined })
        }
        return {
          isOpen: true,
          title: config.title,
          message: config.message,
          input: config.input,
          actions: config.actions,
          children: config.children,
          resolve
        }
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    if (modal.resolve) {
      modal.resolve({ action: null })
    }
    setModal(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [modal.resolve])

  const handleAction = useCallback((actionValue: string | null, inputValue?: string) => {
    if (modal.resolve) {
      modal.resolve({ action: actionValue, input: inputValue })
    }
    setModal(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [modal.resolve])

  return (
    <ModalContext.Provider value={{ showModal }}>
      {children}
      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        input={modal.input}
        actions={modal.actions}
        children={modal.children}
        onClose={handleClose}
        onAction={handleAction}
      />
    </ModalContext.Provider>
  )
}
