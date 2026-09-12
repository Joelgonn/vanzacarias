'use client'

import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { getAnthropometryInfo } from '@/lib/anthropometryEducationalInfo'

type Props = {
  itemKey: string
  category: 'medida' | 'dobra'
}

export function AnthropometryTooltip({ itemKey, category }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 })
  const [imgError, setImgError] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const info = getAnthropometryInfo(itemKey, category)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    const maxW = Math.min(360, vw - 32)
    const tooltipW = Math.min(maxW, 320)
    const tooltipH = tooltipRect.height || 260

    let top = rect.top - tooltipH - gap
    let left = rect.left + rect.width / 2 - tooltipW / 2

    if (top < 8) {
      top = rect.bottom + gap
    }
    if (left + tooltipW > vw - 16) left = vw - tooltipW - 16
    if (left < 16) left = 16
    if (top + tooltipH > vh - 8) top = Math.max(8, vh - tooltipH - 8)
    if (top < 8) top = 8

    setPos({ top, left, width: tooltipW })
  }, [])

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => updatePosition())
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleReposition = () => updatePosition()
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside as any, { passive: true })
    document.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && tooltipRef.current) {
      ro = new ResizeObserver(() => updatePosition())
      ro.observe(tooltipRef.current)
    }
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside as any)
      document.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      if (ro) ro.disconnect()
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (open) {
      const t = setTimeout(updatePosition, 0)
      return () => clearTimeout(t)
    }
  }, [open, updatePosition])

  useEffect(() => {
    setImgError(false)
  }, [itemKey])

  if (!info) return null

  const tooltipContent = open ? (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        zIndex: 9999,
      }}
      className="rounded-xl border border-stone-200 bg-white p-3 shadow-xl"
    >
      <p className="text-xs font-black text-stone-800">{info.title}</p>
      <p className="mt-1 text-[11px] leading-snug text-stone-600">{info.description}</p>
      {!imgError ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-stone-100 bg-stone-50">
          <img
            src={info.image}
            alt={info.imageAlt}
            width={600}
            height={400}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-auto w-full object-contain"
            style={{ maxHeight: '220px' }}
          />
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] text-stone-400">Imagem educativa ainda não disponível para este item.</p>
        </div>
      )}
      {info.caption && <p className="mt-1.5 text-[10px] leading-snug text-stone-500">{info.caption}</p>}
      <p className="mt-1.5 text-[10px] leading-snug text-stone-400">Imagem educativa — ilustra o local correto da aferição.</p>
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Informações sobre ${info.title}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-300 shrink-0"
      >
        <Info size={12} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(tooltipContent, document.body) : null}
    </>
  )
}
