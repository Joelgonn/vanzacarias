'use client';

import { AlertCircle, AlertTriangle, Ban, ClipboardList } from 'lucide-react';

interface RestrictionsSummary {
  hasRestrictions: boolean;
  allergies: number;
  intolerances: number;
  restrictions: number;
}

interface RestrictionsSidebarProps {
  restrictionsSummary: RestrictionsSummary;
}

export function RestrictionsSidebar({ restrictionsSummary }: RestrictionsSidebarProps) {
  if (!restrictionsSummary?.hasRestrictions) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
          Restrições
        </span>
      </div>

      <div className="text-[11px] font-medium text-amber-700 space-y-1.5">
        {restrictionsSummary.allergies > 0 && (
          <div className="flex items-center gap-1.5"><Ban size={12} className="text-red-500 shrink-0" /> {restrictionsSummary.allergies} alergia(s)</div>
        )}
        {restrictionsSummary.intolerances > 0 && (
          <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500 shrink-0" /> {restrictionsSummary.intolerances} intolerância(s)</div>
        )}
        {restrictionsSummary.restrictions > 0 && (
          <div className="flex items-center gap-1.5"><ClipboardList size={12} className="text-blue-500 shrink-0" /> {restrictionsSummary.restrictions} restrição(ões)</div>
        )}
      </div>

      <div className="text-[9px] font-bold text-amber-600 pt-2 border-t border-amber-200/50 leading-relaxed">
        Alimentos bloqueados aparecem com estilo cortado e não podem ser adicionados.
      </div>
    </div>
  );
}
