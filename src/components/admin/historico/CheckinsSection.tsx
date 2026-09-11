'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarCheck, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { cn, ui } from '@/ui/system';
// Fonte de verdade única do tipo: continua sendo o page.tsx (import type é
// apagado em tempo de compilação, portanto não existe ciclo em runtime).
import type { CheckinData } from '@/app/admin/paciente/[id]/historico/page';

/* =========================================================================
 * CHECK-INS — Sprint Histórico / Fase 1 (redesign responsivo)
 * -------------------------------------------------------------------------
 * Escopo: SOMENTE a seção CHECK-INS.
 * - Não busca dados, não altera queries/API/regras de negócio.
 * - Recebe `history` por props na ordem original (CRESCENTE) e apenas
 *   inverte a ordem para APRESENTAÇÃO (mais recente primeiro), exatamente
 *   como a tabela anterior fazia via `history.slice().reverse()`.
 * - Únicos cálculos: delta aritmético simples de peso (atual - anterior),
 *   usado somente para indicar direção (↑ / ↓ / →). Sem interpretação
 *   clínica e sem novos indicadores.
 * - `item.imc` chega PRONTO de fetchData (Fase 1.1, regra definitiva: quando o
 *   registro não traz altura, o cálculo usa a altura de REFERÊNCIA do
 *   histórico). Aqui só há formatação — nenhum IMC é recalculado.
 * ========================================================================= */

export type CheckinsSectionProps = {
  /** Check-ins na ordem original entregue por fetchData (created_at ASC). */
  history: CheckinData[];
  /**
   * RESERVADO — contrato preservado da Sprint (item 5/19).
   * `getMoodIcon` recebido de page.tsx classifica humor por RÓTULO
   * ('feliz' | 'neutro' | 'dificil'), usado originalmente para
   * `daily_logs.mood`. O check-in semanal grava `humor_semanal` como NÚMERO
   * 1–5 e não existe, em nenhum lugar do projeto, um mapeamento
   * número → rótulo. Criar esse mapeamento seria "nova lógica de
   * classificação" (proibido pelo item 15), portanto o humor é exibido
   * numericamente (n/5 + estrelas derivadas do próprio número) e esta prop
   * permanece sem uso até autorização explícita.
   */
  getMoodIcon?: (mood: string) => ReactNode;
};

type CheckinRowData = {
  item: CheckinData;
  previous: CheckinData | null;
  isCurrent: boolean;
};

/* -------------------------------------------------------------------------
 * Helpers de APRESENTAÇÃO (formatação/derivação visual — sem regra clínica)
 * ------------------------------------------------------------------------- */

/**
 * Converte para número apenas quando o dado REALMENTE existe.
 * `Number(null)` é 0 e `Number('')` é 0 — tratá-los como número faria um
 * registro sem adesão/humor aparecer como "0/5" (afirmando um valor que não
 * existe). Ausente permanece ausente e é exibido como '—'.
 */
const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Ausente → '—'; caso contrário, o valor é exibido como está armazenado. */
const formatWeight = (value: unknown): string => {
  const n = asNumber(value);
  if (n === null) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
};

/** Espelha `item.altura ? ... : 0` de fetchData: altura não positiva = ausente. */
const formatHeight = (value: unknown): string => {
  const n = asNumber(value);
  if (n === null || n <= 0) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`;
};

/**
 * O IMC já chega PREPARADO por fetchData (Sprint Fase 1.1, regra definitiva):
 * quando o check-in não registra altura, o cálculo usa a altura de REFERÊNCIA
 * do histórico (a altura válida mais recente do conjunto). Por isso NÃO se faz
 * nenhum gate sobre a altura do próprio registro aqui — caso contrário um
 * registro sem altura esconderia um IMC perfeitamente válido.
 * `imc <= 0` é o sentinela de "indisponível" (nenhuma altura válida no
 * histórico). Nenhum IMC é recalculado neste componente.
 */
const formatImc = (imc: unknown): string => {
  const n = asNumber(imc);
  if (n === null || n <= 0) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

const formatScore = (value: unknown): string => {
  const n = asNumber(value);
  if (n === null) return '—';
  return `${n}/5`;
};

/** Estrelas derivadas do próprio número 1–5. O valor numérico sempre
 *  acompanha (a11y), então nenhuma informação é substituída. */
const renderStars = (value: unknown): string => {
  const n = asNumber(value);
  if (n === null) return '☆☆☆☆☆';
  const filled = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
};

/** Limiar >= 4 é o MESMO já usado pela tabela anterior de check-ins. */
const adherenceTone = (value: unknown): { badge: string; star: string } => {
  const n = asNumber(value);
  if (n === null) return { badge: ui.badgeNeutral, star: 'text-stone-300' };
  if (n >= 4) return { badge: ui.badgeSuccess, star: 'text-emerald-500' };
  return { badge: ui.badgeWarning, star: 'text-amber-500' };
};

type WeightDelta = { text: string } | null;

/**
 * Delta de peso: somente `atual - anterior`, arredondado à precisão
 * exibida (1 casa) para não contradizer os valores mostrados.
 * Proibido por escopo: qualquer leitura clínica ("melhorou", "perdeu"...),
 * portanto a cor do chip é NEUTRA — apenas direção.
 */
const buildWeightDelta = (current: unknown, previous: unknown): WeightDelta => {
  const c = asNumber(current);
  const p = asNumber(previous);
  if (c === null || p === null || c <= 0 || p <= 0) return null;

  const diff = Math.round((c - p) * 10) / 10;
  if (diff === 0) return { text: '→ 0 kg' };

  const abs = Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return { text: `${diff > 0 ? '↑' : '↓'} ${abs} kg` };
};

/* -------------------------------------------------------------------------
 * Registro individual — estado de expand/collapse LOCAL a cada registro
 * ------------------------------------------------------------------------- */
function CheckinRow({ data }: { data: CheckinRowData }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const { item, previous, isCurrent } = data;
  const delta = buildWeightDelta(item.peso, previous?.peso);
  const hasComment =
    typeof item.comentarios === 'string' && item.comentarios.trim().length > 0;
  const adesao = adherenceTone(item.adesao_ao_plano);

  return (
    <li className={cn('relative', isCurrent && 'bg-emerald-50/40')}>
      {/* Trilho da timeline (contínuo entre registros) */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-[22px] top-0 w-px bg-stone-200 md:left-[26px]"
      />
      {/* Marcador do registro */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[17px] top-5 h-[11px] w-[11px] rounded-full ring-4 md:left-[21px] md:top-6',
          isCurrent ? 'bg-emerald-500 ring-emerald-100' : 'bg-stone-300 ring-white',
        )}
      />

      <div className="py-4 pl-10 pr-4 md:py-5 md:pl-12 md:pr-6">
        {/* Data + identificação do registro atual */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-bold tabular-nums text-stone-800 md:text-sm">
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </span>
          {isCurrent && (
            <>
              <span className={cn(ui.badge, ui.badgeSuccess)}>Atual</span>
              <span className="hidden text-[11px] font-medium text-emerald-700 md:inline">
                registro mais recente
              </span>
            </>
          )}
        </div>

        {/* Peso + delta */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 md:mt-2.5">
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <Scale size={15} strokeWidth={2.5} className="shrink-0" />
            <span className="text-base font-extrabold leading-none tabular-nums md:text-lg">
              {formatWeight(item.peso)}
            </span>
          </span>
          {delta && (
            <span
              title="Variação em relação ao check-in anterior"
              className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-stone-500"
            >
              {delta.text}
            </span>
          )}
        </div>

        {/* Adesão + humor (dados existentes, sem reinterpretação) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 md:mt-3">
          <div className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('text-[13px] leading-none tracking-tight', adesao.star)}
            >
              {renderStars(item.adesao_ao_plano)}
            </span>
            <span className="text-[11px] font-semibold text-stone-500">Adesão</span>
            <span className={cn(ui.badge, adesao.badge)}>
              {formatScore(item.adesao_ao_plano)}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="text-[13px] leading-none tracking-tight text-stone-400"
            >
              {renderStars(item.humor_semanal)}
            </span>
            <span className="text-[11px] font-semibold text-stone-500">Humor</span>
            <span className={cn(ui.badge, ui.badgeNeutral)}>
              {formatScore(item.humor_semanal)}
            </span>
          </div>
        </div>

        {/* Resumo do comentário (sem espaço vazio quando não houver) */}
        {hasComment && (
          <p className="mt-2.5 text-xs font-medium leading-relaxed text-stone-600 md:mt-3 md:text-[13px]">
            <span className="hidden font-bold text-stone-500 md:inline">Comentário: </span>
            <span className="line-clamp-1 break-words md:line-clamp-2">
              {item.comentarios}
            </span>
          </p>
        )}

        {/* Detalhes sob demanda */}
        <div className="mt-3 md:mt-3.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className={cn(
              ui.buttonSecondary,
              // Área de toque confortável no mobile sem alterar o padrão no desktop
              'min-h-11 md:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2',
            )}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Recolher' : 'Ver detalhes'}
          </button>
        </div>

        {expanded && (
          <div
            id={detailsId}
            className="mt-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3 transition-all duration-200 md:p-4"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Altura
                </dt>
                {/* Valor REALMENTE registrado neste check-in (não a efetiva). */}
                <dd className="text-sm font-bold tabular-nums text-stone-700">
                  {formatHeight(item.altura)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  IMC
                </dt>
                <dd className="text-sm font-bold tabular-nums text-stone-700">
                  {formatImc(item.imc)}
                </dd>
              </div>
            </dl>

            {hasComment && (
              <div className="mt-3 border-t border-stone-200/70 pt-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Comentário
                </p>
                <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed text-stone-600 md:text-[13px]">
                  {item.comentarios}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------
 * Seção
 * ------------------------------------------------------------------------- */
export default function CheckinsSection({ history }: CheckinsSectionProps) {
  // `history` chega em ordem CRESCENTE (created_at ASC) e NÃO é mutado:
  // `.map()` já cria um novo array, e `.reverse()` atua somente sobre ele.
  // `previous` é o registro cronologicamente anterior (history[index - 1]).
  const rows: CheckinRowData[] = history
    .map((item, index) => ({
      item,
      previous: index > 0 ? history[index - 1] : null,
      isCurrent: index === history.length - 1,
    }))
    .reverse();

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold tracking-tight text-stone-900 md:mb-6 md:text-xl">
        <div className="rounded-xl bg-stone-100 p-2 text-stone-600">
          <CalendarCheck size={18} />
        </div>
        Histórico de Check-ins
      </h2>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center shadow-sm md:rounded-3xl">
          <p className="text-sm font-medium italic text-stone-400">
            Nenhum check-in registrado.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:rounded-3xl">
          <ol className="divide-y divide-stone-100">
            {rows.map((row) => (
              <CheckinRow key={row.item.id} data={row} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
