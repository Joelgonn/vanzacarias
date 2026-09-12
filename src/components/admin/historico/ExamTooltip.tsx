'use client'

import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { EXAM_EDUCATIONAL_INFO, STATUS_EDUCATIONAL } from '@/lib/examEducationalInfo'
import { cn } from '@/ui/system'

type Props = {
  examKey: string
  status: 'normal' | 'warning' | 'danger' | 'neutral'
  statusText: string
}

export function ExamTooltip({ examKey, status, statusText }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const info = EXAM_EDUCATIONAL_INFO[examKey]
  const statusInfo = STATUS_EDUCATIONAL[status] || STATUS_EDUCATIONAL.normal

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    const maxW = Math.min(300, vw - 32)
    const tooltipW = Math.min(maxW, tooltipRect.width || 280)
    const tooltipH = tooltipRect.height || 180

    // Preferir acima
    let top = rect.top - tooltipH - gap
    let left = rect.left + rect.width / 2 - tooltipW / 2

    // Se não há espaço acima, abrir abaixo
    if (top < 8) {
      top = rect.bottom + gap
    }

    // Ajuste horizontal — borda direita
    if (left + tooltipW > vw - 16) {
      left = vw - tooltipW - 16
    }
    // Borda esquerda
    if (left < 16) {
      left = 16
    }

    // Garantir dentro da viewport vertical
    if (top + tooltipH > vh - 8) {
      top = Math.max(8, vh - tooltipH - 8)
    }
    if (top < 8) top = 8

    setPos({ top, left, width: tooltipW })
  }, [])

  useEffect(() => {
    if (!open) return
    // Calcular após render
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

    // ResizeObserver para tooltip size
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
      // Reposicionar após conteúdo renderizar (ex: 280px)
      const t = setTimeout(updatePosition, 0)
      return () => clearTimeout(t)
    }
  }, [open, updatePosition])

  if (!info) return null

  const statusLabel =
    status === 'danger'
      ? `${info.title} acima ou abaixo da referência`
      : status === 'warning'
        ? `${info.title} fora do intervalo ideal`
        : statusText

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
        zIndex: 9999,
      }}
      className="rounded-xl border border-stone-200 bg-white p-3 shadow-xl"
    >
      <p className="text-xs font-black text-stone-800">{info.title}</p>
      <p className="mt-1 text-[11px] leading-snug text-stone-600">
        <span className="font-bold">O que é:</span> {info.whatItMeasures}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-stone-600">
        <span className="font-bold">Significado prático:</span> {info.practicalMeaning}
      </p>
      <div className="mt-2 rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
          Status: {statusInfo.label}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-stone-600">{statusInfo.text}</p>
        <p className="mt-1 text-[10px] font-medium text-stone-500">Exibido: {statusLabel}</p>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-stone-400">
        Classificação informativa — interpretar com valores de referência do laboratório.
      </p>
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

export function ExamStatusWithTooltip({ examKey, status, statusText }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border',
          status === 'danger'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : status === 'warning'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : status === 'normal'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-stone-50 text-stone-500 border-stone-200'
        )}
      >
        {statusText}
      </span>
      <ExamTooltip examKey={examKey} status={status as any} statusText={statusText} />
    </span>
  )
}
