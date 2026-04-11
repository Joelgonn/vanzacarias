// /src/ui/system.tsx
// UI Core System - Design tokens e componentes reutilizáveis

export const ui = {
  // ============================================================
  // CARDS
  // ============================================================
  card: `
    bg-white dark:bg-stone-900 rounded-2xl md:rounded-3xl border
    border-stone-100 dark:border-stone-800
    shadow-sm dark:shadow-stone-900/30

    transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]

    hover:-translate-y-1.5 hover:scale-[1.015]
    hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)]
    dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]

    active:scale-[0.98]
  `,

  cardInteractive: `
    group cursor-pointer relative overflow-hidden
  `,

  glowOverlay: `
    absolute inset-0 opacity-0 group-hover:opacity-100
    transition-opacity duration-500
    bg-gradient-to-br from-white/40 via-transparent to-amber-50/30
    dark:from-white/5 dark:via-transparent dark:to-amber-500/10
    pointer-events-none
  `,

  // ============================================================
  // BOTÕES PREMIUM (efeito cinza → dourado)
  // ============================================================
  buttonPrimary: `
    relative overflow-hidden
    bg-nutri-800 dark:bg-nutri-700 text-white font-semibold
    border border-nutri-700 dark:border-nutri-600
    shadow-md shadow-nutri-800/30 dark:shadow-nutri-900/50

    hover:bg-nutri-700 dark:hover:bg-nutri-600
    hover:border-amber-400 dark:hover:border-amber-500
    hover:shadow-xl hover:shadow-amber-500/30
    hover:-translate-y-0.5
    hover:text-amber-100

    active:bg-nutri-800 dark:active:bg-nutri-800
    active:border-amber-500 dark:active:border-amber-400
    active:shadow-2xl active:shadow-amber-500/50
    active:text-amber-200
    active:ring-2 active:ring-amber-400/60 active:ring-offset-2
    active:ring-offset-white dark:active:ring-offset-stone-900
    active:scale-[0.97]

    transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
    rounded-xl px-4 h-9 md:px-5 md:h-11 flex items-center justify-center gap-1.5 text-xs md:text-sm
  `,

  buttonGhost: `
    relative overflow-hidden
    bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-medium
    border border-stone-200 dark:border-stone-700
    shadow-sm

    hover:bg-amber-50 dark:hover:bg-amber-950/30
    hover:border-amber-300 dark:hover:border-amber-700
    hover:text-amber-600 dark:hover:text-amber-400
    hover:-translate-y-0.5

    active:scale-[0.97]
    active:ring-1 active:ring-amber-400/50

    transition-all duration-200
    rounded-lg px-3 h-8 flex items-center justify-center gap-1.5 text-xs font-medium
  `,

  buttonDanger: `
    relative overflow-hidden
    bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-medium
    border border-rose-200 dark:border-rose-800
    shadow-sm

    hover:bg-rose-100 dark:hover:bg-rose-950/50
    hover:border-rose-300 dark:hover:border-rose-700
    hover:text-rose-700 dark:hover:text-rose-300

    active:scale-[0.97]
    active:ring-1 active:ring-rose-400/50

    transition-all duration-200
    rounded-lg px-3 h-8 flex items-center justify-center gap-1.5 text-xs font-medium
  `,

  buttonOutline: `
    relative overflow-hidden
    bg-transparent text-stone-600 dark:text-stone-300 font-semibold
    border-2 border-stone-300 dark:border-stone-600

    hover:border-amber-400 dark:hover:border-amber-500
    hover:shadow-md hover:shadow-amber-500/20
    hover:-translate-y-0.5
    hover:text-amber-600 dark:hover:text-amber-400

    active:border-amber-600 dark:active:border-amber-400
    active:shadow-lg active:shadow-amber-500/40
    active:text-amber-700 dark:active:text-amber-300
    active:ring-2 active:ring-amber-400/50 active:ring-offset-2
    active:scale-[0.97]

    transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
    rounded-xl px-4 h-9 md:px-5 md:h-11 flex items-center justify-center gap-1.5 text-xs md:text-sm
  `,

  buttonSmall: `
    relative overflow-hidden
    bg-nutri-800 dark:bg-nutri-700 text-white font-semibold
    border border-nutri-700 dark:border-nutri-600
    shadow-sm shadow-nutri-800/30

    hover:bg-nutri-700 hover:border-amber-400
    hover:shadow-md hover:shadow-amber-500/30
    hover:-translate-y-0.5
    hover:text-amber-100

    active:scale-[0.95]
    active:ring-1 active:ring-amber-400/60

    transition-all duration-200
    rounded-lg px-2 h-7 text-[10px] flex items-center justify-center gap-1
  `,

  // ============================================================
  // BADGES
  // ============================================================
  badge: `
    px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1
  `,

  badgeSuccess: `
    bg-emerald-50 dark:bg-emerald-950/30 
    text-emerald-700 dark:text-emerald-400 
    border border-emerald-100 dark:border-emerald-800
  `,

  badgeWarning: `
    bg-amber-50 dark:bg-amber-950/30 
    text-amber-700 dark:text-amber-400 
    border border-amber-100 dark:border-amber-800
  `,

  badgeInfo: `
    bg-nutri-50 dark:bg-nutri-950/30 
    text-nutri-700 dark:text-nutri-400 
    border border-nutri-100 dark:border-nutri-800
  `,

  badgeDanger: `
    bg-rose-50 dark:bg-rose-950/30 
    text-rose-700 dark:text-rose-400 
    border border-rose-100 dark:border-rose-800
  `,

  badgeNeutral: `
    bg-stone-100 dark:bg-stone-800 
    text-stone-500 dark:text-stone-400 
    border border-stone-200 dark:border-stone-700
  `,

  // ============================================================
  // HEADER
  // ============================================================
  header: `
    bg-white dark:bg-stone-900 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl
    shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] dark:shadow-stone-900/50
    border border-stone-100/80 dark:border-stone-800/80
    hover:shadow-xl hover:shadow-amber-500/10 dark:hover:shadow-amber-500/5
    transition-all duration-500
  `,

  headerTitle: `
    text-xl md:text-3xl font-extrabold 
    text-stone-900 dark:text-white 
    tracking-tight leading-none
  `,

  // ============================================================
  // INPUTS
  // ============================================================
  input: `
    w-full rounded-xl border 
    border-stone-200 dark:border-stone-700
    bg-stone-50/50 dark:bg-stone-800/50 
    hover:bg-white dark:hover:bg-stone-800 
    focus:bg-white dark:focus:bg-stone-800
    focus:border-amber-400 dark:focus:border-amber-500 
    focus:ring-4 focus:ring-amber-50 dark:focus:ring-amber-950/30
    outline-none transition-all
    font-medium text-sm md:text-base 
    text-stone-700 dark:text-stone-200
    placeholder:text-stone-400 dark:placeholder:text-stone-500 
    shadow-sm
  `,

  inputError: `
    border-red-400 dark:border-red-600
    focus:border-red-500 focus:ring-red-50 dark:focus:ring-red-950/30
  `,

  inputSuccess: `
    border-emerald-400 dark:border-emerald-600
    focus:border-emerald-500 focus:ring-emerald-50 dark:focus:ring-emerald-950/30
  `,

  // ============================================================
  // GRID
  // ============================================================
  grid: `
    grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4
  `,

  // ============================================================
  // MODAL
  // ============================================================
  modalOverlay: `
    fixed inset-0 z-50 flex items-end sm:items-center justify-center
    bg-stone-900/60 dark:bg-stone-950/80 backdrop-blur-sm
    p-0 sm:p-4 animate-in fade-in duration-200
  `,

  modalContainer: `
    bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl
    w-full max-w-3xl flex flex-col
    max-h-[85vh] sm:max-h-[90vh] shadow-2xl
    animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300
  `,

  // ============================================================
  // DIVIDERS
  // ============================================================
  divider: `
    border-t border-stone-100 dark:border-stone-800
    my-3 md:my-4
  `,

  dividerLight: `
    border-t border-stone-50 dark:border-stone-800/50
    my-2 md:my-3
  `,
};

// ============================================================
// SKELETON LOADING COMPONENT
// ============================================================
export function SkeletonCard() {
  return (
    <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-28 bg-stone-200 dark:bg-stone-700 rounded-lg" />
            <div className="h-3 w-20 bg-stone-150 dark:bg-stone-800 rounded" />
          </div>
          <div className="h-6 w-16 bg-stone-150 dark:bg-stone-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 bg-stone-100 dark:bg-stone-800 rounded-xl" />
          <div className="h-14 bg-stone-100 dark:bg-stone-800 rounded-xl" />
        </div>
        <div className="h-16 bg-stone-50 dark:bg-stone-800/50 rounded-xl" />
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-stone-100 dark:bg-stone-800 rounded-lg" />
          <div className="h-8 w-16 bg-stone-100 dark:bg-stone-800 rounded-lg" />
          <div className="h-8 w-16 bg-stone-100 dark:bg-stone-800 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-stone-100 dark:bg-stone-800 rounded-lg" />
          <div className="h-8 flex-1 bg-stone-100 dark:bg-stone-800 rounded-lg" />
          <div className="h-8 flex-1 bg-stone-100 dark:bg-stone-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SKELETON PARA TABELA/LISTA
// ============================================================
export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-stone-100 dark:border-stone-800 animate-pulse">
      <div className="h-8 w-8 bg-stone-200 dark:bg-stone-700 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 bg-stone-200 dark:bg-stone-700 rounded" />
        <div className="h-2 w-36 bg-stone-150 dark:bg-stone-800 rounded" />
      </div>
      <div className="h-6 w-16 bg-stone-150 dark:bg-stone-800 rounded-lg" />
    </div>
  );
}

// ============================================================
// SKELETON PARA ESTATÍSTICAS
// ============================================================
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-3 divide-x divide-stone-100 dark:divide-stone-800">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 md:p-5 text-center animate-pulse">
          <div className="h-2.5 w-12 bg-stone-200 dark:bg-stone-700 rounded mx-auto mb-2" />
          <div className="h-6 w-10 bg-stone-200 dark:bg-stone-700 rounded mx-auto" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Função para combinar classes condicionalmente
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Função para criar ripple effect em botões
export function createRippleEffect(event: React.MouseEvent<HTMLElement>) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.className = 'absolute rounded-full bg-white/40 dark:bg-white/30 animate-ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.pointerEvents = 'none';

  button.style.position = 'relative';
  button.style.overflow = 'hidden';
  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}