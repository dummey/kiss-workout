import { useState, useMemo, useCallback } from 'react'

interface UsePaginationOptions {
  totalItems: number
  initialPageSize?: number
  initialPage?: number
}

interface UsePaginationReturn {
  currentPage: number
  pageSize: number
  totalPages: number
  startIndex: number
  endIndex: number
  pageItems: <T>(items: T[]) => T[]
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setPageSize: (size: number) => void
  reset: () => void
}

export function usePagination({
  totalItems,
  initialPageSize = 12,
  initialPage = 1
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalItems / pageSize)), [totalItems, pageSize])
  const startIndex = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize])
  const endIndex = useMemo(() => startIndex + pageSize, [startIndex, pageSize])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1))
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setCurrentPage(1)
  }, [])

  const reset = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const pageItems = useCallback(<T>(items: T[]): T[] => {
    return items.slice(startIndex, endIndex)
  }, [startIndex, endIndex])

  return {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    reset
  }
}
