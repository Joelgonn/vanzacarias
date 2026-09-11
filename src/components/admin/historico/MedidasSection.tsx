'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, Ruler } from 'lucide-react';
import { cn, ui } from '@/ui/system';
// Fonte de verdade única do tipo: continua sendo o page.tsx (import type é
// apagado em tempo de compilação, portanto não existe ciclo em runtime).
import type { AntroData } from '@/app/admin/paciente/[id]/historico/page';

/* =========================================================================
 * MEDIDAS — Sprint Histórico / Fase 2 (redesign responsivo)
 * -------------------------------------------------------------------------
 * Escopo: SOMENTE a seção MEDIDAS.
 * - Não busca dados, não altera queries/API/banco/regras clínicas.
 * - Recebe `measurements` EXATAMENTE como chega de fetchData (sem transformar):
 *   a MESMA referência alimenta `timelineData`/`latestMetabolicData` em outras
 *   seções, então nada é preparado fora daqui.
 * - Ordem recebida: `order('measurement_date', { ascending: false })`
 *   → DECRESCENTE, logo measurements[0] é o registro MAIS RECENTE ("Atual").
 * - Nenhum array de entrada é mutado.
 * - Todos os 7 campos de AntroData são exibidos; ausentes aparecem como '—'.
 * ========================================================================= */

export type MedidasSectionProps = {
  /** Medições na ordem original entregue por fetchData (measurement_date DESC). */
  measurements: AntroData[];
};

type MedidaRowData = {
  item: AntroData;
  /** Registro cronologicamente ANTERIOR (mais antigo) — para deltas. */
  previous: AntroData | null;
  isCurrent: boolean;
};

type MeasureKind = 'weight' | 'height' | 'circ';

/** Ordem espelha a declaração de AntroData (peso, altura, cintura, quadril,
 *  braço, panturrilha, pescoço) — sem sugerir hierarquia clínica. */
const MEASURES: { key: keyof AntroData; label: string; kind: MeasureKind }[] = [
  { key: 'weight', label: 'Peso', kind: 'weight' },
  { key: 'height', label: 'Altura', kind: 'height' },
  { key: 'waist', label: 'Cintura', kind: 'circ' },
  { key: 'hip', label: 'Quadril', kind: 'circ' },
  { key: 'arm', label: 'Braço', kind: 'circ' },
  { key: 'calf', label: 'Panturrilha', kind: 'circ' },
  { key: 'neck', label: 'Pescoço', kind: 'circ' },
];

/* -------------------------------------------------------------------------
 * Helpers LOCAIS de apresentação (sem regra clínica, sem novos indicadores)
 * ------------------------------------------------------------------------- */

/**
 * Converte para número apenas quando o dado REALMENTE existe.
 * `Number(null)` é 0 e `Number('')` é 0: tratá-los como número faria um campo
 * ausente virar "0 kg"/"0 cm". Ausente permanece ausente.
 */
const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Valor de medida. Não positivo é tratado como AUSENTE (nunca "0 kg"/"0 cm"),
 * exatamente como a tabela anterior fazia (`i.waist ? ... : '-'`): nenhuma
 * medida antropométrica legítima é 0. O valor armazenado nunca é alterado.
 */
const asMeasure = (value: unknown): number | null => {
  const n = asNumber(value);
  if (n === null || n <= 0) return null;
  return n;
};

const num = (n: number, maxFrac: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: maxFrac });

/** Ausente → '—'. Peso em kg; circunferências em cm (convenção do formulário
 *  ClinicalDataModal: "Altura (m)", "Cintura (cm)", ...). */
const formatMeasure = (value: unknown, kind: MeasureKind): string => {
  const n = asMeasure(value);
  if (n === null) return '—';
  if (kind === 'weight') return `${num(n, 1)} kg`;
  if (kind === 'height') {
    // Convenção do projeto: o formulário grava altura em METROS. Valores >= 3
    // são legado em cm (mesmo limiar de normalizeHeight do metabolicModel/SSOT).
    // O número armazenado é preservado — muda apenas o rótulo da unidade.
    return n < 3 ? `${num(n, 2)} m` : `${num(n, 0)} cm`;
  }
  return `${num(n, 1)} cm`;
};

/** Unidade usada no delta (mesma convenção de formatMeasure). */
const unitOf = (value: unknown, kind: MeasureKind): string => {
  if (kind === 'weight') return 'kg';
  if (kind === 'height') {
    const n = asMeasure(value);
    return n !== null && n >= 3 ? 'cm' : 'm';
  }
  return 'cm';
};

type Delta = { text: string } | null;

/**
 * Delta: SOMENTE `atual - anterior`, arredondado à precisão exibida, indicando
 * apenas direção (↑ / ↓ / →). Sem "melhorou/piorou/ganhou/perdeu" e sem
 * qualquer leitura clínica. Cor neutra (a direção não é juízo de valor).
 * Altura NÃO recebe delta: a unidade pode variar entre registros legados
 * (metros/cm), o que produziria um número enganoso.
 */
const buildDelta = (
  current: unknown,
  previous: unknown,
  kind: MeasureKind,
): Delta => {
  if (kind === 'height') return null;
  const c = asMeasure(current);
  const p = asMeasure(previous);
  if (c === null || p === null) return null;

  const diff = Math.round((c - p) * 10) / 10;
  const unit = unitOf(c, kind);
  if (diff === 0) return { text: `→ 0 ${unit}` };

  return { text: `${diff > 0 ? '↑' : '↓'} ${num(Math.abs(diff), 1)} ${unit}` };
};

/* -------------------------------------------------------------------------
 * Célula de medida (rótulo + valor + delta opcional)
 * ------------------------------------------------------------------------- */
function MeasureCell({
  label,
  value,
  kind,
  previous,
  tone,
  showDelta,
}: {
  label: string;
  value: unknown;
  kind: MeasureKind;
  previous: unknown;
  tone: 'snapshot' | 'plain';
  showDelta: boolean;
}) {
  const delta = showDelta ? buildDelta(value, previous, kind) : null;
  const isEmpty = asMeasure(value) === null;

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border p-2.5',
        tone === 'snapshot'
          ? 'border-nutri-100/80 bg-white/80'
          : 'border-stone-100 bg-stone-50/60',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums md:text-[15px]',
          // Peso mantém o token já usado no projeto (tabela anterior de
          // Medidas, Check-ins e dashboard). Circunferências ficam neutras:
          // nenhuma medida é colorida como boa/ruim.
          kind === 'weight' && !isEmpty ? 'text-emerald-600' : 'text-stone-700',
        )}
      >
        {formatMeasure(value, kind)}
      </p>
      {delta && (
        <span
          title="Variação em relação à medição anterior"
          className="mt-1 inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-stone-500"
        >
          {delta.text}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Registro anterior — resumido, com detalhes expansíveis
 * ------------------------------------------------------------------------- */
function MedidaRow({ data }: { data: MedidaRowData }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const { item, previous } = data;

  const weightDelta = buildDelta(item.weight, previous?.weight, 'weight');

  return (
    <li className="px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[13px] font-bold tabular-nums text-stone-800 md:text-sm">
          {new Date(item.measurement_date).toLocaleDateString('pt-BR')}
        </span>
        <span className="text-sm font-extrabold tabular-nums text-emerald-600">
          {formatMeasure(item.weight, 'weight')}
        </span>
        {weightDelta && (
          <span
            title="Variação em relação à medição anterior"
            className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-stone-500"
          >
            {weightDelta.text}
          </span>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className={cn(
            ui.buttonSecondary,
            'ml-auto min-h-11 md:min-h-0',
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
          className="mt-3 grid grid-cols-2 gap-2.5 transition-all duration-200 md:grid-cols-4 xl:grid-cols-7"
        >
          {MEASURES.map((m) => (
            <MeasureCell
              key={m.key}
              label={m.label}
              value={item[m.key]}
              kind={m.kind}
              previous={previous?.[m.key]}
              tone="plain"
              showDelta
            />
          ))}
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------
 * Seção
 * ------------------------------------------------------------------------- */
export default function MedidasSection({ measurements }: MedidasSectionProps) {
  // Sem mutação: `.map()` cria novo array. Em ordem DECRESCENTE o registro
  // cronologicamente anterior é measurements[index + 1].
  const rows: MedidaRowData[] = measurements.map((item, index) => ({
    item,
    previous: index + 1 < measurements.length ? measurements[index + 1] : null,
    isCurrent: index === 0,
  }));

  const current = rows[0] ?? null;
  const anteriores = rows.slice(1);

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold tracking-tight text-stone-900 md:mb-6 md:text-xl">
        <div className="rounded-xl bg-stone-100 p-2 text-stone-600">
          <Ruler size={18} />
        </div>
        Circunferências
      </h2>

      {!current ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center shadow-sm md:rounded-3xl">
          <p className="text-sm font-medium italic text-stone-400">
            Nenhuma medida cadastrada.
          </p>
        </div>
      ) : (
        <>
          {/* SNAPSHOT do registro ATUAL — todas as medidas, sem ranking clínico */}
          <section className="rounded-2xl border border-nutri-100 bg-nutri-50/40 p-3 shadow-sm md:rounded-3xl md:p-4">
            <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:mb-3.5">
              <span className="text-[13px] font-bold tabular-nums text-stone-800 md:text-sm">
                {new Date(current.item.measurement_date).toLocaleDateString('pt-BR')}
              </span>
              {/* Destaque apenas TEMPORAL: token de marca (info), não sucesso/alerta */}
              <span className={cn(ui.badge, ui.badgeInfo)}>Atual</span>
              <span className="hidden text-[11px] font-medium text-nutri-700 md:inline">
                medição mais recente
              </span>
            </header>

            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 xl:grid-cols-7">
              {MEASURES.map((m) => (
                <MeasureCell
                  key={m.key}
                  label={m.label}
                  value={current.item[m.key]}
                  kind={m.kind}
                  previous={current.previous?.[m.key]}
                  tone="snapshot"
                  showDelta
                />
              ))}
            </div>
          </section>

          {/* REGISTROS ANTERIORES — resumidos e expansíveis */}
          {anteriores.length > 0 && (
            <section className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:mt-5 md:rounded-3xl">
              <p className="border-b border-stone-100 bg-stone-50/80 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 md:px-4">
                Medições anteriores ({anteriores.length})
              </p>
              <ul className="divide-y divide-stone-100">
                {anteriores.map((row) => (
                  <MedidaRow key={row.item.id} data={row} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
