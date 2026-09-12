'use client';

import { useId, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cn, ui } from '@/ui/system';
import { PROTOCOLS } from '@/lib/nutrition/bodyComposition';
// Fonte de verdade única do tipo: continua sendo o page.tsx (import type é
// apagado em tempo de compilação, portanto não existe ciclo em runtime).
import type { SkinfoldsData } from '@/app/admin/paciente/[id]/historico/page';

/* =========================================================================
 * DOBRAS / BF% — DO-0001.0-F2.0 (correção JP7 / Σ9×Σ7)
 * -------------------------------------------------------------------------
 * FASE 2.0 corrigiu a cadeia histórica:
 * - timelineData.somatorio_dobras agora é JP7 correto (motor central);
 * - sumOf7 usa exatamente os 7 sítios JP7 (sem biceps/calf);
 * - matching por data apenas (sem toFixed como chave);
 * - null≠0 (ausência não vira zero).
 * ========================================================================= */

export type DobrasSectionProps = {
  /** Protocolos na ordem original entregue por fetchData (measurement_date DESC). */
  skinfolds: SkinfoldsData[];
  /** Pontos JÁ CALCULADOS por timelineData em page.tsx (não recalculados aqui). */
  timeline: TimelinePoint[];
  patientAge: number | null;
  sexo?: string;
};

/** Subconjunto ESTRUTURAL de timelineData realmente consumido pela seção. */
type TimelinePoint = {
  date: string;
  somatorio_dobras: number | null;
  imc: number | null;
  bf: number | null;
  fatMass: number | null;
  leanMass: number | null;
  protocol?: string | null;
  density?: number | null;
  skinfoldId?: string | null;
};

type FoldKey =
  | 'triceps' | 'biceps' | 'subscapular' | 'axillary_media' | 'pectoral'
  | 'suprailiac' | 'abdominal' | 'thigh' | 'calf';

/** As 9 dobras, na ordem e com a NOMENCLATURA já usadas pelo projeto
 *  (ClinicalDataModal.tsx → aba Dobras). */
const FOLDS: { key: FoldKey; label: string }[] = [
  { key: 'triceps', label: 'Tricipital' },
  { key: 'biceps', label: 'Bicipital' },
  { key: 'subscapular', label: 'Subescapular' },
  { key: 'axillary_media', label: 'Axilar Média' },
  { key: 'pectoral', label: 'Peitoral' },
  { key: 'suprailiac', label: 'Suprailíaca' },
  { key: 'abdominal', label: 'Abdominal' },
  { key: 'thigh', label: 'Coxa' },
  { key: 'calf', label: 'Panturrilha' },
];

type DobraRowData = {
  item: SkinfoldsData;
  previous: SkinfoldsData | null;
  isCurrent: boolean;
};

/* -------------------------------------------------------------------------
 * Helpers LOCAIS (apresentação apenas)
 * ------------------------------------------------------------------------- */

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Valor de dobra/medida: não positivo é AUSENTE — mesma semântica da interface
 *  anterior (`i.triceps || '-'`), onde 0 também caía como ausente. */
const asValue = (value: unknown): number | null => {
  const n = asNumber(value);
  if (n === null || n <= 0) return null;
  return n;
};

/** Renderização de DADOS BRUTOS idêntica à da interface anterior
 *  (ex.: `{i.triceps}`, `{currentPoint.imc}`). Mantida de propósito para não
 *  alterar separador/precisão já apresentados pela seção (ver §10). */
const raw = (value: unknown): string => String(value);

/**
 * SOMA — respeita protocolo da medição (F3.3)
 * Se protocol válido, soma exatamente os sites daquele protocolo; senão null (não assumir JP7).
 * Fallback para JP7 só para cálculo histórico quando protocol ausente já foi eliminado em F3.3 (timeline não calculará).
 */
const JP7_SITES: FoldKey[] = ['pectoral', 'axillary_media', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'];
const parseFoldStrict = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
// Soma para exibição — baseada no protocolo da própria medição (sem fallback JP7 para NULL)
const sumForProtocol = (item: SkinfoldsData, protocol: string | null | undefined, sex: string | undefined): number | null => {
  const valid = protocol === 'jp3' || protocol === 'jp7' || protocol === 'petroski4';
  if (!valid) return null;
  // Deriva sexo para protocolos dependentes
  const s = (sexo: string | undefined) => {
    const g = (sexo || '').toLowerCase().trim();
    if (['masculino','homem','m','male'].includes(g)) return 'M' as const;
    if (['feminino','mulher','f','female'].includes(g)) return 'F' as const;
    return null;
  };
  const sexNorm = s(sex);
  if (!sexNorm) {
    // Sem sexo não é possível determinar sites para JP3/Petroski — tratar como indisponível
    // Para JP7 ambos os sexos têm mesmos 7, então permite
    if (protocol !== 'jp7') return null;
    const vals = JP7_SITES.map(k => parseFoldStrict((item as unknown as Record<string, unknown>)[k]));
    if (vals.some(v => v === null)) return null;
    return (vals as number[]).reduce((a,b)=>a+b,0);
  }
  const sites = (PROTOCOLS as any)[protocol].sitesBySex[sexNorm] as FoldKey[];
  const vals = sites.map(k => parseFoldStrict((item as unknown as Record<string, unknown>)[k]));
  if (vals.some(v => v === null)) return null;
  return (vals as number[]).reduce((a,b)=>a+b,0);
};
// Mantido para compat — agora delega a protocol (se item tem protocol, usa; senão null)
const sumOf7 = (item: SkinfoldsData): number | null => {
  const p = (item as any).protocol ?? null;
  // Se item tem protocolo válido, usa protocolo; senão mantém comportamento JP7 legado para não quebrar exibição antiga?
  // F3.3: NULL histórico não é JP7 — então retorna null
  if (p !== 'jp3' && p !== 'jp7' && p !== 'petroski4') return null;
  // Para compat, se p é jp7, usa JP7; se outro, sumForProtocol já trata
  return sumForProtocol(item, p, undefined as any);
};

const formatD = (d: string) => new Date(d).toISOString().split('T')[0];

/** Mesma semântica do `|| '-'` original, apenas com o marcador do projeto. */
const show = (value: number | null | undefined): string =>
  value ? String(value) : '—';

type Delta = { text: string } | null;

/** Delta simples (atual − anterior) apenas numérico/direcional. Sem qualquer
 *  leitura clínica ("melhorou/piorou/…"). Renderização dos números no mesmo
 *  estilo bruto já usado pela seção. */
const buildDelta = (current: unknown, previous: unknown, unit = 'mm'): Delta => {
  const c = asValue(current);
  const p = asValue(previous);
  if (c === null || p === null) return null;
  const diff = Math.round((c - p) * 10) / 10;
  if (diff === 0) return { text: `→ 0 ${unit}` };
  return { text: `${diff > 0 ? '↑' : '↓'} ${raw(Math.abs(diff))} ${unit}` };
};

/* -------------------------------------------------------------------------
 * Célula de dobra
 * ------------------------------------------------------------------------- */
function FoldCell({
  label,
  value,
  previous,
  tone,
}: {
  label: string;
  value: unknown;
  previous: unknown;
  tone: 'dark' | 'light';
}) {
  const delta = buildDelta(value, previous, 'mm');
  const missing = asValue(value) === null;

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border p-2.5',
        tone === 'dark'
          ? 'border-white/10 bg-white/5'
          : 'border-stone-100 bg-stone-50/60',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          tone === 'dark' ? 'text-stone-400' : 'text-stone-400',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums',
          missing
            ? tone === 'dark' ? 'text-stone-500' : 'text-stone-400'
            : tone === 'dark' ? 'text-white' : 'text-stone-700',
        )}
      >
        {missing ? '—' : `${raw(value)} mm`}
      </p>
      {delta && (
        <span
          title="Variação em relação ao protocolo anterior"
          className={cn(
            'mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
            tone === 'dark'
              ? 'border-white/10 bg-white/5 text-stone-400'
              : 'border-stone-200 bg-stone-50 text-stone-500',
          )}
        >
          {delta.text}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Indicador (rótulo + valor + unidade)
 * ------------------------------------------------------------------------- */
function Indicator({
  label,
  text,
  unit,
  tone,
}: {
  label: string;
  text: string;
  unit?: string;
  tone: 'dark' | 'light';
}) {
  const missing = text === '—';
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border p-2.5',
        tone === 'dark'
          ? 'border-white/10 bg-white/5'
          : 'border-stone-100 bg-stone-50/60',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums md:text-[15px]',
          tone === 'dark' ? (missing ? 'text-stone-500' : 'text-white') : (missing ? 'text-stone-400' : 'text-stone-700'),
        )}
      >
        {text}
        {!missing && unit ? (
          <span className="ml-1 text-[11px] font-bold uppercase opacity-60">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Protocolo ANTERIOR — resumido, detalhes expansíveis
 * ------------------------------------------------------------------------- */
function DobraRow({
  data,
  timeline,
  sexo,
}: {
  data: DobraRowData;
  timeline: TimelinePoint[];
  sexo?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [otherOpenRow, setOtherOpenRow] = useState(false);
  const detailsId = useId();
  const otherRowId = useId();
  const { item, previous } = data;

  // F3.3 — associação por skinfoldId quando disponível, fallback por data; sem toFixed
  const tPoint = timeline.find((t) => (t.skinfoldId && t.skinfoldId === item.id) || t.date === formatD(item.measurement_date));
  // Soma vem do timeline (já protocol-aware via motor); sumOf7 é fallback compatível
  const sum = tPoint?.somatorio_dobras ?? sumOf7(item);

  const bf = tPoint?.bf;
  const imc = tPoint?.imc;
  const mMag = tPoint?.leanMass;
  const mGorda = tPoint?.fatMass;

  return (
    <li className="px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[13px] font-bold tabular-nums text-stone-800 md:text-sm">
          {new Date(item.measurement_date).toLocaleDateString('pt-BR')}
        </span>
        <span className="text-[13px] font-black tabular-nums text-stone-700 md:text-sm">
          {sum !== null ? `${sum.toFixed(1)} mm` : '—'}
        </span>
        {tPoint?.protocol ? (
          <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-600">
            {tPoint.protocol === 'jp3' ? 'JP3' : tPoint.protocol === 'jp7' ? 'JP7' : 'Petroski4'}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
            S/ protocolo
          </span>
        )}
        {bf ? (
          <span className="text-[13px] font-extrabold tabular-nums text-amber-500 md:text-sm">
            {bf}%
          </span>
        ) : null}

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
        <div id={detailsId} className="mt-3 transition-all duration-200">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            <Indicator label="Soma das dobras" text={sum !== null ? sum.toFixed(1) : '—'} unit="mm" tone="light" />
            <Indicator label="IMC" text={show(imc)} tone="light" />
            <Indicator label="BF%" text={show(bf)} unit="%" tone="light" />
            <Indicator label="Massa magra" text={show(mMag)} unit="kg" tone="light" />
            <Indicator label="Massa gorda" text={show(mGorda)} unit="kg" tone="light" />
          </div>
          {(() => {
            const proto = (item as any).protocol ?? null;
            const isValid = proto === 'jp3' || proto === 'jp7' || proto === 'petroski4';
            if (!isValid) {
              return (
                <div className="mt-2.5 grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-9">
                  {FOLDS.map((f) => (
                    <FoldCell key={f.key} label={f.label} value={item[f.key]} previous={previous?.[f.key]} tone="light" />
                  ))}
                </div>
              );
            }
            const g = (sexo || '').toLowerCase().trim();
            const sexNorm = ['masculino','homem','m','male'].includes(g) ? 'M' as const : ['feminino','mulher','f','female'].includes(g) ? 'F' as const : null;
            const sites: FoldKey[] | null = (() => {
              if (!sexNorm && proto !== 'jp7') return null;
              if (!sexNorm && proto === 'jp7') return [...JP7_SITES];
              return (PROTOCOLS as any)[proto].sitesBySex[sexNorm!] as FoldKey[];
            })();
            if (!sites) {
              return (
                <div className="mt-2.5">
                  <p className="mb-2 text-xs font-bold text-amber-600">Sexo não disponível — exibindo 9 dobras brutas.</p>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-9">
                    {FOLDS.map((f) => (
                      <FoldCell key={f.key} label={f.label} value={item[f.key]} previous={previous?.[f.key]} tone="light" />
                    ))}
                  </div>
                </div>
              );
            }
            const mainFolds = sites.map(k => FOLDS.find(f=>f.key===k)!).filter(Boolean);
            const otherFolds = FOLDS.filter(f => !sites.includes(f.key) && asValue((item as any)[f.key]) !== null);
            return (
              <>
                <div className="mt-2.5 grid grid-cols-3 gap-2 md:grid-cols-5" style={{gridTemplateColumns: `repeat(${Math.min(mainFolds.length, 5)}, minmax(0,1fr))`}}>
                  {mainFolds.map((f) => (
                    <FoldCell key={f.key} label={f.label} value={item[f.key]} previous={previous?.[f.key]} tone="light" />
                  ))}
                </div>
                {otherFolds.length > 0 && (
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    <button type="button" onClick={()=>setOtherOpenRow(v=>!v)} aria-expanded={otherOpenRow} aria-controls={otherRowId} className={cn(ui.buttonSecondary, 'min-h-11 w-full justify-center', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2')}>
                      {otherOpenRow ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                      {otherOpenRow ? 'Recolher outras dobras' : `Outras dobras coletadas (${otherFolds.length})`}
                    </button>
                    <div id={otherRowId} className={cn('mt-2 grid grid-cols-3 gap-2 md:grid-cols-5', otherOpenRow ? 'grid' : 'hidden')}>
                      {otherFolds.map((f)=> (
                        <FoldCell key={f.key} label={f.label} value={item[f.key]} previous={previous?.[f.key]} tone="light" />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------
 * Seção
 * ------------------------------------------------------------------------- */
export default function DobrasSection({
  skinfolds,
  timeline,
  patientAge,
  sexo,
}: DobrasSectionProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const otherOpenId = useId();

  // Sem mutação: em ordem DECRESCENTE o protocolo anterior é skinfolds[i + 1].
  const rows: DobraRowData[] = skinfolds.map((item, index) => ({
    item,
    previous: index + 1 < skinfolds.length ? skinfolds[index + 1] : null,
    isCurrent: index === 0,
  }));

  const current = rows[0] ?? null;
  const anteriores = rows.slice(1);

  if (!current) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center shadow-sm md:rounded-3xl">
          <p className="text-sm font-medium italic text-stone-400">
            Nenhum protocolo cadastrado.
          </p>
        </div>
      </div>
    );
  }

  // Composição do registro ATUAL — via timeline com protocolo da própria medição, associação por id
  const currentPoint = timeline.slice().reverse().find((t) => (t.skinfoldId && t.skinfoldId === current.item.id) || t.date === formatD(current.item.measurement_date));
  const currentSum = currentPoint?.somatorio_dobras ?? sumOf7(current.item);

  const initialPoint = timeline.find((t) => t.bf !== null && t.bf !== undefined);

  const getDelta = (current2: number, initial: number) => (current2 - initial).toFixed(1);
  const renderDelta = (delta: string, reverseColors = false) => {
    const val = parseFloat(delta);
    if (isNaN(val) || val === 0) return <span className="text-stone-500">Mantido</span>;
    const isPositive = val > 0;

    let colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
    if (reverseColors) {
      colorClass = isPositive ? 'text-rose-400' : 'text-emerald-400';
    }

    return (
      <span className={`font-bold flex items-center gap-0.5 ${colorClass}`}>
        {isPositive ? '+' : ''}{delta}
      </span>
    );
  };

  const compositionOk = !!currentPoint?.bf && patientAge !== null;

  return (
    <div className="animate-in fade-in duration-300">
      {/* ============ SNAPSHOT — protocolo ATUAL (compacto) ============ */}
      <div className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 p-4 text-white shadow-lg md:mb-6 md:gap-5 md:rounded-3xl md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white opacity-5 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              <Layers size={14} /> Composição Corporal
              <span className="hidden sm:inline">({currentPoint?.protocol ? (currentPoint.protocol === 'jp3' ? 'JP3' : currentPoint.protocol === 'jp7' ? 'JP7' : currentPoint.protocol === 'petroski4' ? 'Petroski 4' : currentPoint.protocol) : 'Protocolo não registrado'})</span>
            </h3>
            {/* Destaque apenas TEMPORAL */}
            <span className="inline-flex items-center rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-300">
              Atual
            </span>
            {currentPoint?.protocol ? (
              <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                {currentPoint.protocol === 'jp3' ? 'JP3' : currentPoint.protocol === 'jp7' ? 'JP7' : 'Petroski 4'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                Protocolo não registrado
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium text-stone-400 md:text-sm">
            {patientAge !== null ? (
              `Idade: ${patientAge} anos (${sexo || 'Indefinido'}). ${currentPoint?.protocol ? '' : 'Protocolo da medição não registrado — resultado indisponível como JP7 oficial.'}`
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-300">
                <AlertCircle size={12} /> Idade ausente no perfil.
              </span>
            )}
          </p>
        </div>

        {/* 5 indicadores — grid responsivo 2→3→5, indisponível explícito */}
        <div className="relative z-10 grid w-full grid-cols-2 gap-2.5 border-t border-white/10 pt-4 md:grid-cols-3 md:gap-3 lg:grid-cols-5">
          {/* IMC */}
          <div className="flex min-h-[96px] flex-col rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner backdrop-blur-md">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-cyan-200/60">Índice IMC</span>
            <div className="mb-2 flex min-h-[28px] items-baseline">
              {currentPoint?.imc ? (
                <span className="text-xl font-black tracking-tight text-cyan-400 md:text-2xl">{currentPoint.imc}</span>
              ) : (
                <span className="text-[11px] font-bold leading-tight text-stone-400">IMC indisponível</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">
              {initialPoint?.imc && currentPoint?.imc && (
                <>
                  <span className="flex justify-between">Início: <span className="text-cyan-100/70">{initialPoint.imc}</span></span>
                  <span className="flex justify-between">Evol: {renderDelta(getDelta(currentPoint.imc, initialPoint.imc), true)}</span>
                </>
              )}
            </div>
          </div>

          {/* % GORDURA */}
          <div className="flex min-h-[96px] flex-col rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner backdrop-blur-md">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-200/60">% Gordura</span>
            <div className="mb-2 flex min-h-[28px] items-baseline">
              {currentPoint?.bf ? (
                <>
                  <span className="text-xl font-black tracking-tight text-amber-400 md:text-2xl">{currentPoint.bf}</span>
                  <span className="ml-1 text-[10px] font-bold uppercase text-amber-400/60">%</span>
                </>
              ) : (
                <span className="text-[11px] font-bold leading-tight text-stone-400">BF% indisponível</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">
              {initialPoint?.bf && currentPoint?.bf && (
                <>
                  <span className="flex justify-between">Início: <span className="text-amber-100/70">{initialPoint.bf}%</span></span>
                  <span className="flex justify-between">Evol: {renderDelta(getDelta(currentPoint.bf, initialPoint.bf), true)}%</span>
                </>
              )}
            </div>
          </div>

          {/* MASSA MAGRA */}
          <div className="flex min-h-[96px] flex-col rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner backdrop-blur-md">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-emerald-200/60">Massa Magra</span>
            <div className="mb-2 flex min-h-[28px] items-baseline">
              {currentPoint?.leanMass ? (
                <>
                  <span className="text-xl font-black tracking-tight text-emerald-400 md:text-2xl">{currentPoint.leanMass}</span>
                  <span className="ml-1 text-[10px] font-bold uppercase text-emerald-400/60">kg</span>
                </>
              ) : (
                <span className="text-[11px] font-bold leading-tight text-stone-400">Massa magra indisponível</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">
              {initialPoint?.leanMass && currentPoint?.leanMass && (
                <>
                  <span className="flex justify-between">Início: <span className="text-emerald-100/70">{initialPoint.leanMass}</span></span>
                  <span className="flex justify-between">Evol: {renderDelta(getDelta(currentPoint.leanMass, initialPoint.leanMass))} kg</span>
                </>
              )}
            </div>
          </div>

          {/* MASSA GORDA */}
          <div className="flex min-h-[96px] flex-col rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner backdrop-blur-md">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-rose-200/60">Massa Gorda</span>
            <div className="mb-2 flex min-h-[28px] items-baseline">
              {currentPoint?.fatMass ? (
                <>
                  <span className="text-xl font-black tracking-tight text-rose-400 md:text-2xl">{currentPoint.fatMass}</span>
                  <span className="ml-1 text-[10px] font-bold uppercase text-rose-400/60">kg</span>
                </>
              ) : (
                <span className="text-[11px] font-bold leading-tight text-stone-400">Massa gorda indisponível</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">
              {initialPoint?.fatMass && currentPoint?.fatMass && (
                <>
                  <span className="flex justify-between">Início: <span className="text-rose-100/70">{initialPoint.fatMass}</span></span>
                  <span className="flex justify-between">Evol: {renderDelta(getDelta(currentPoint.fatMass, initialPoint.fatMass), true)} kg</span>
                </>
              )}
            </div>
          </div>

          {/* SOMA DAS DOBRAS */}
          <div className="flex min-h-[96px] flex-col rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner backdrop-blur-md">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-stone-400">Soma das dobras</span>
            <div className="mb-2 flex min-h-[28px] items-baseline">
              {currentSum !== null ? (
                <>
                  <span className="text-xl font-black tracking-tight text-stone-200 md:text-2xl">{currentSum.toFixed(1)}</span>
                  <span className="ml-1 text-[10px] font-bold uppercase text-stone-400">mm</span>
                </>
              ) : (
                <span className="text-[11px] font-bold leading-tight text-stone-400">Soma indisponível</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-white/5 pt-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">
              {current.previous && sumOf7(current.previous) !== null && currentSum !== null && (
                <>
                  <span className="flex justify-between">Anterior: <span className="text-stone-300">{(sumOf7(current.previous) as number).toFixed(1)}</span></span>
                  <span className="flex justify-between">Variação: <span className="font-bold text-stone-300">{(() => { const prev = sumOf7(current.previous!); const d = buildDelta(currentSum, prev, 'mm'); return d ? d.text : '—'; })()}</span></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Alertas compactos */}
        {!compositionOk && (
          <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            Atenção: atualize o peso na mesma data das dobras para calcular a composição corporal.
          </span>
        )}
        {currentPoint && !currentPoint.protocol && (
          <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-stone-700 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-stone-300">
            Protocolo não registrado. Os dados históricos estão sendo exibidos sem cálculo oficial.
          </span>
        )}

        {/* DOBRAS — 9 em uma única linha desktop (compacto) */}
        {(() => {
          const proto = (current.item as any).protocol ?? null;
          const isValid = proto === 'jp3' || proto === 'jp7' || proto === 'petroski4';
          const g = (sexo || '').toLowerCase().trim();
          const sexNorm = ['masculino','homem','m','male'].includes(g) ? 'M' as const : ['feminino','mulher','f','female'].includes(g) ? 'F' as const : null;
          const protocolSites: FoldKey[] | null = isValid ? (() => {
            if (!sexNorm && proto !== 'jp7') return null;
            if (!sexNorm && proto === 'jp7') return [...JP7_SITES];
            return (PROTOCOLS as any)[proto].sitesBySex[sexNorm!] as FoldKey[];
          })() : null;
          return (
            <div className="relative z-10 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
                  Dobras cutâneas — 9 medidas
                </h4>
                {isValid && protocolSites && (
                  <span className="text-[10px] font-bold text-stone-500">
                    Protocolo: <span className="text-stone-300">{proto === 'jp3' ? 'Jackson & Pollock — 3 dobras' : proto === 'jp7' ? 'Jackson & Pollock — 7 dobras' : 'Petroski — 4 dobras'}</span>
                    {sexNorm ? ` · ${sexNorm}` : ' · sem sexo'}
                  </span>
                )}
              </div>
              {!isValid && currentPoint && !currentPoint.protocol && (
                <p className="mt-1.5 text-[11px] font-bold text-amber-300">Protocolo não registrado — exibindo histórico sem cálculo oficial.</p>
              )}
              <div className="mt-3 overflow-x-auto -mx-1 px-1 scrollbar-thin">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-9 gap-2 min-w-0">
                  {FOLDS.map((f) => {
                    const isRequired = !!protocolSites?.includes(f.key);
                    return (
                      <div
                        key={f.key}
                        className={cn(
                          'min-w-0 rounded-lg border p-2',
                          isRequired ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5'
                        )}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 truncate">
                          {f.label}
                        </p>
                        <p className="mt-0.5 text-sm font-black tabular-nums truncate text-white">
                          {asValue((current.item as any)[f.key]) !== null ? `${(current.item as any)[f.key]} mm` : '—'}
                        </p>
                        {isRequired && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
                            protocolo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ============ PROTOCOLOS ANTERIORES ============ */}
      {anteriores.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:rounded-3xl">
          <p className="border-b border-stone-100 bg-stone-50/80 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 md:px-4">
            Protocolos anteriores ({anteriores.length})
          </p>
          <ul className="divide-y divide-stone-100">
            {anteriores.map((row) => (
              <DobraRow key={row.item.id} data={row} timeline={timeline} sexo={sexo} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
