import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '../hooks/usePagination'

describe('usePagination', () => {
  it('initializes with correct default state', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    expect(result.current.currentPage).toBe(1)
    expect(result.current.pageSize).toBe(12)
    expect(result.current.totalPages).toBe(5)
    expect(result.current.startIndex).toBe(0)
    expect(result.current.endIndex).toBe(12)
  })

  it('goes to next page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    act(() => result.current.nextPage())
    expect(result.current.currentPage).toBe(2)
    expect(result.current.startIndex).toBe(12)
    expect(result.current.endIndex).toBe(24)
  })

  it('goes to previous page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50, initialPage: 3 }))
    act(() => result.current.prevPage())
    expect(result.current.currentPage).toBe(2)
  })

  it('does not go past the last page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 24 }))
    act(() => result.current.nextPage())
    act(() => result.current.nextPage())
    expect(result.current.currentPage).toBe(2)
  })

  it('does not go below page 1', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 24 }))
    act(() => result.current.prevPage())
    expect(result.current.currentPage).toBe(1)
  })

  it('goes to a specific page', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    act(() => result.current.goToPage(3))
    expect(result.current.currentPage).toBe(3)
    expect(result.current.startIndex).toBe(24)
  })

  it('clamps page to valid range', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    act(() => result.current.goToPage(0))
    expect(result.current.currentPage).toBe(1)
    act(() => result.current.goToPage(100))
    expect(result.current.currentPage).toBe(5)
  })

  it('changes page size and resets to page 1', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    act(() => result.current.nextPage())
    act(() => result.current.setPageSize(24))
    expect(result.current.pageSize).toBe(24)
    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(3)
  })

  it('returns the correct page slice of items', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const { result } = renderHook(() => usePagination({ totalItems: 50 }))
    expect(result.current.pageItems(items)).toEqual(items.slice(0, 12))
    act(() => result.current.nextPage())
    expect(result.current.pageItems(items)).toEqual(items.slice(12, 24))
  })

  it('handles zero total items', () => {
    const { result } = renderHook(() => usePagination({ totalItems: 0 }))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.currentPage).toBe(1)
  })
})
