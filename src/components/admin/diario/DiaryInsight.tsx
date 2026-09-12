'use client'

import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import type { DiaryInsightContent } from '@/lib/diario/diarioInsights'
import { diaryStatusMeta } from '@/lib/diario/diarioRules'

type Props = {
  insight: DiaryInsightContent
  label?: string
}

export function DiaryInsight({ insight, label = 'Ver insight' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const meta = diaryStatusMeta[insight.status]

  const updatePos = useCallback(() => {
    if (!triggerRef.current || !popRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popRect = popRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    const maxW = Math.min(360, vw - 32)
    const w = Math.min(maxW, 340)
    const h = popRect.height || 200
    let top = rect.bottom + gap
    let left = rect.left + rect.width / 2 - w / 2
    // flip to top if overflow bottom
    if (top + h > vh - 8) top = rect.top - h - gap
    if (left + w > vw - 16) left = vw - w - 16
    if (left < 16) left = 16
    if (top < 8) top = 8
    setPos({ top, left, width: w })
  }, [])

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => updatePos())
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(t) && popRef.current && !popRef.current.contains(t)) setOpen(false)
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const handleReposition = () => updatePos()
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside as any, { passive: true })
    document.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && popRef.current) { ro = new ResizeObserver(() => updatePos()); ro.observe(popRef.current) }
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside as any)
      document.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      if (ro) ro.disconnect()
    }
  }, [open, updatePos])

  useEffect(() => { if (open) { const t = setTimeout(updatePos, 0); return () => clearTimeout(t) } }, [open, updatePos])

  const pop = open ? (
    <div
      ref={popRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={insight.title}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', zIndex: 9999 }}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-widest text-stone-700">{insight.title}</p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Fechar insight" className="shrink-0 rounded-full p-1 hover:bg-stone-100 text-stone-500">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.bg} ${meta.border} ${meta.color}`}>
        {meta.label}
      </span>
      <p className="mt-2 text-sm leading-snug text-stone-600">{insight.description}</p>
      {insight.recommendation && <p className="mt-2 text-xs leading-snug text-stone-500 bg-stone-50 border border-stone-100 rounded-xl p-2.5">{insight.recommendation}</p>}
      {insight.questions && insight.questions.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Perguntas sugeridas</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {insight.questions.map((q, i) => (
              <li key={i} className="text-xs text-stone-600">{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:bg-white hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-300 shrink-0"
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(pop, document.body) : null}
    </>
  )
}
