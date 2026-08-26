'use client';

import { ShoppingCart, X, CalendarDays, Activity, Target, CheckCheck, Copy } from 'lucide-react';

const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

type MarketItem = {
  name: string;
  qty: number;
  unit: string;
  originalName: string;
};

type MarketList = {
  measured: MarketItem[];
  others: string[];
};

type MarketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  marketList: MarketList;
  marketMultiplier: number;
  onSetMarketMultiplier: (val: number) => void;
  isCopied: boolean;
  onShareWhatsApp: () => void;
  onCopyToClipboard: () => void;
};

export function MarketModal({ isOpen, onClose, marketList, marketMultiplier, onSetMarketMultiplier, isCopied, onShareWhatsApp, onCopyToClipboard }: MarketModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]">
        
        <div className="p-6 md:p-8 bg-emerald-700 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ShoppingCart size={24} /></div>
            <div>
              <h3 className="font-black text-2xl tracking-tight leading-tight">Compras da Semana</h3>
              <p className="text-xs text-emerald-100 font-medium opacity-90">Calculado automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
        </div>

        <div className="bg-stone-50 border-b border-stone-200 p-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2"><CalendarDays size={14} /> Selecione o Período</label>
          <div className="flex bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm p-1">
            {[
              { label: 'Dia', val: 1 }, 
              { label: '7 Dias', val: 7 }, 
              { label: '15 Dias', val: 15 }, 
              { label: 'Mês', val: 30 }
            ].map(tab => (
              <button key={tab.val} onClick={() => onSetMarketMultiplier(tab.val)} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${marketMultiplier === tab.val ? 'bg-emerald-700 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto bg-white flex-1 space-y-8">
          {marketList.measured.length === 0 && marketList.others.length === 0 ? (
            <div className="text-center py-10 text-stone-400 flex flex-col items-center gap-3">
              <ShoppingCart size={40} className="opacity-20"/>
              <p className="font-medium">Nenhum item quantificável encontrado no protocolo.</p>
            </div>
          ) : (
            <>
              {marketList.measured.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2"><Activity size={14}/> Itens com Medida Exata</h4>
                  <ul className="space-y-3">
                    {marketList.measured.map((item, i) => (
                      <li key={i} className="flex justify-between items-center bg-stone-50 p-3 rounded-2xl border border-stone-100">
                        <span className="font-bold text-stone-700 text-sm">{item.name}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-xs font-black shadow-sm">{Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2))} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {marketList.others.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2"><Target size={14}/> Consumo Livre / Outros</h4>
                  <ul className="space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    {marketList.others.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600 font-medium"><span className="text-emerald-500 mt-0.5">•</span> {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {(marketList.measured.length > 0 || marketList.others.length > 0) && (
          <div className="p-5 border-t border-stone-100 bg-white flex gap-3 pb-8 sm:pb-5">
            <button onClick={onShareWhatsApp} className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20 active:scale-[0.98]">
              <WhatsAppIcon size={20} /><span>Enviar para WhatsApp</span>
            </button>
            <button onClick={onCopyToClipboard} className={`px-6 rounded-2xl font-bold flex items-center justify-center transition-all border ${isCopied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'}`} title="Copiar lista">
              {isCopied ? <CheckCheck size={20} /> : <Copy size={20} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
