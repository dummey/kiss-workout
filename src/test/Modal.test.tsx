import { describe, it, expect, beforeEach, act } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal, { ModalProps } from '../components/Modal'

function renderModal(props: Partial<ModalProps> = {}) {
  const defaultProps: ModalProps = {
    isOpen: true,
    title: 'Test Modal',
    message: 'Test message',
    actions: [
      { label: 'Cancel', value: null },
      { label: 'Confirm', value: 'confirm' }
    ],
    onClose: () => {},
    onAction: () => {},
    ...props
  }
  return render(<Modal {...defaultProps} />)
}

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
  })

  it('renders title and message when open', () => {
    renderModal()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    renderModal()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('calls onAction when button clicked', async () => {
    const onAction = vi.fn()
    renderModal({ onAction })
    await userEvent.click(screen.getByText('Confirm'))
    expect(onAction).toHaveBeenCalledWith('confirm', undefined)
  })

  it('calls onClose when overlay clicked', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    await userEvent.click(screen.getByText('Test Modal').parentElement!.parentElement!)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders input when provided', () => {
    renderModal({
      input: { defaultValue: 'Test', placeholder: 'Enter text' }
    })
    const input = screen.getByDisplayValue('Test')
    expect(input).toBeInTheDocument()
    expect(input.getAttribute('placeholder')).toBe('Enter text')
  })

  it('passes input value on Enter key', async () => {
    const onAction = vi.fn()
    renderModal({ onAction, input: { defaultValue: 'test-value' } })
    const input = screen.getByDisplayValue('test-value')
    await userEvent.type(input, '{Enter}')
    expect(onAction).toHaveBeenCalledWith('confirm', 'test-value')
  })

  it('applies correct variant classes', () => {
    renderModal({
      actions: [
        { label: 'Danger', value: 'danger', variant: 'danger' },
        { label: 'Success', value: 'success', variant: 'success' },
        { label: 'Primary', value: 'primary', variant: 'primary' }
      ]
    })
    expect(screen.getByText('Danger').className).toContain('btn')
    expect(screen.getByText('Success').className).toContain('btn-success')
    expect(screen.getByText('Primary').className).toContain('btn-primary')
  })
})
