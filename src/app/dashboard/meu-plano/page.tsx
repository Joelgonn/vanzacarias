'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, FileText, Download, ChevronLeft, Lock, Star, 
  Clock, Utensils, ChevronRight, Info, Filter, ShoppingCart, 
  X, CalendarDays, Copy, CheckCheck, ArrowLeftRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

// =========================================================================
// ÍCONE CUSTOMIZADO DO WHATSAPP
// =========================================================================
const WhatsAppIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

// =========================================================================
// TIPAGEM PARA A TABELA DE SUBSTITUIÇÕES (Evita erro de build do TS)
// =========================================================================
interface MacrosItem {
  carbo: number;
  proteina: number;
  gordura: number;
  kcal: number;
}

interface SubstituicaoItem {
  nome: string;
  medida: string;
  macros?: MacrosItem; // "?" avisa o TS que pode não ter macro (ex: alface)
}

interface SubstituicaoGrupo {
  categoria: string;
  referencia?: {
    descricao: string;
    carbo?: number;
    proteina?: number;
    gordura?: number;
  };
  itens: SubstituicaoItem[];
}

// =========================================================================
// TABELA PADRÃO DE SUBSTITUIÇÕES (COM MACROS)
// =========================================================================
const SUBSTITUICOES_PADRAO: SubstituicaoGrupo[] = [
  {
    categoria: "Carboidratos (~25g de carboidrato)",
    referencia: { descricao: "Equivalente a ~100g de arroz cozido", carbo: 25 },
    itens: [
      { nome: "Arroz branco cozido", medida: "100g", macros: { carbo: 28, proteina: 2.5, gordura: 0.3, kcal: 130 } },
      { nome: "Batata inglesa cozida", medida: "150g", macros: { carbo: 26, proteina: 2, gordura: 0.1, kcal: 110 } },
      { nome: "Batata doce cozida", medida: "100g", macros: { carbo: 24, proteina: 1, gordura: 0.1, kcal: 100 } },
      { nome: "Macarrão cozido", medida: "120g", macros: { carbo: 30, proteina: 5, gordura: 1, kcal: 160 } },
      { nome: "Aveia em flocos", medida: "30g (3 colheres)", macros: { carbo: 20, proteina: 5, gordura: 3, kcal: 120 } },
      { nome: "Pão francês", medida: "1 unidade (50g)", macros: { carbo: 28, proteina: 8, gordura: 2, kcal: 140 } },
      { nome: "Cuscuz de milho", medida: "100g", macros: { carbo: 25, proteina: 2, gordura: 1, kcal: 120 } }
    ]
  },
  {
    categoria: "Proteínas (~25g de proteína)",
    referencia: { descricao: "Equivalente a ~100g de frango", proteina: 25 },
    itens: [
      { nome: "Peito de frango grelhado", medida: "100g", macros: { carbo: 0, proteina: 31, gordura: 3, kcal: 165 } },
      { nome: "Carne bovina magra", medida: "100g", macros: { carbo: 0, proteina: 26, gordura: 10, kcal: 200 } },
      { nome: "Tilápia grelhada", medida: "120g", macros: { carbo: 0, proteina: 26, gordura: 2, kcal: 140 } },
      { nome: "Lombo suíno magro", medida: "100g", macros: { carbo: 0, proteina: 27, gordura: 8, kcal: 190 } },
      { nome: "Ovos inteiros", medida: "4 unidades", macros: { carbo: 2, proteina: 24, gordura: 20, kcal: 280 } },
      { nome: "Atum em água", medida: "120g", macros: { carbo: 0, proteina: 28, gordura: 1, kcal: 130 } }
    ]
  },
  {
    categoria: "Gorduras (~10g de gordura)",
    referencia: { descricao: "Equivalente a 1 colher de azeite", gordura: 10 },
    itens: [
      { nome: "Azeite de oliva", medida: "1 colher de sopa (10ml)", macros: { carbo: 0, proteina: 0, gordura: 10, kcal: 90 } },
      { nome: "Castanhas", medida: "15g", macros: { carbo: 3, proteina: 3, gordura: 10, kcal: 110 } },
      { nome: "Pasta de amendoim", medida: "15g", macros: { carbo: 3, proteina: 4, gordura: 8, kcal: 95 } },
      { nome: "Abacate", medida: "70g", macros: { carbo: 6, proteina: 1, gordura: 10, kcal: 120 } },
      { nome: "Chia", medida: "15g", macros: { carbo: 5, proteina: 3, gordura: 9, kcal: 100 } }
    ]
  },
  {
    categoria: "Frutas (~15g de carboidrato)",
    referencia: { descricao: "Porção média de fruta", carbo: 15 },
    itens: [
      { nome: "Maçã", medida: "1 unidade média", macros: { carbo: 15, proteina: 0, gordura: 0, kcal: 70 } },
      { nome: "Banana", medida: "1 unidade média", macros: { carbo: 23, proteina: 1, gordura: 0, kcal: 90 } },
      { nome: "Mamão", medida: "100g", macros: { carbo: 11, proteina: 0, gordura: 0, kcal: 45 } },
      { nome: "Morangos", medida: "150g", macros: { carbo: 12, proteina: 1, gordura: 0, kcal: 50 } },
      { nome: "Abacaxi", medida: "2 fatias", macros: { carbo: 16, proteina: 0, gordura: 0, kcal: 65 } },
      { nome: "Laranja", medida: "1 unidade média", macros: { carbo: 15, proteina: 1, gordura: 0, kcal: 70 } }
    ]
  },
  {
    categoria: "Legumes e Verduras (baixo impacto calórico)",
    referencia: { descricao: "Consumo livre (ricos em fibras)" },
    itens: [
      { nome: "Alface", medida: "à vontade" },
      { nome: "Tomate", medida: "à vontade" },
      { nome: "Brócolis", medida: "à vontade" },
      { nome: "Cenoura", medida: "à vontade" },
      { nome: "Abobrinha", medida: "à vontade" }
    ]
  }
];

// =========================================================================
// RENDERIZADOR DE TEXTO INTELIGENTE (TOOLTIPS NO CARDÁPIO)
// =========================================================================
const renderDescriptionWithTooltips = (text: string) => {
  const rules = [
    { match: /\b(batata doce)\b/gi, tooltip: "Batata Doce | 100g = 100 kcal | C: 24g | P: 1g | G: 0.1g" },
    { match: /\b(arroz branco|arroz integral|arroz parboilizado|arroz)\b/gi, tooltip: "Arroz | 100g = 130 kcal | C: 28g | P: 2.5g | G: 0.3g" },
    { match: /\b(batata inglesa)\b/gi, tooltip: "Batata Inglesa | 150g = 110 kcal | C: 26g | P: 2g | G: 0.1g" },
    { match: /\b(macarr[ãa]o)\b/gi, tooltip: "Macarrão | 120g = 160 kcal | C: 30g | P: 5g | G: 1g" },
    { match: /\b(aveia)\b/gi, tooltip: "Aveia | 30g = 120 kcal | C: 20g | P: 5g | G: 3g" },
    { match: /\b(p[ãa]o franc[êe]s)\b/gi, tooltip: "Pão Francês | 50g = 140 kcal | C: 28g | P: 8g | G: 2g" },
    { match: /\b(cuscuz)\b/gi, tooltip: "Cuscuz | 100g = 120 kcal | C: 25g | P: 2g | G: 1g" },
    { match: /\b(peito de frango|frango)\b/gi, tooltip: "Frango | 100g = 165 kcal | C: 0g | P: 31g | G: 3g" },
    { match: /\b(til[áa]pia|peixe)\b/gi, tooltip: "Peixe/Tilápia | 120g = 140 kcal | C: 0g | P: 26g | G: 2g" },
    { match: /\b(ovos?)\b/gi, tooltip: "Ovos | 4 un. = 280 kcal | C: 2g | P: 24g | G: 20g" },
    { match: /\b(azeite)\b/gi, tooltip: "Azeite | 1 col. (10ml) = 90 kcal | C: 0g | P: 0g | G: 10g" },
    { match: /\b(abacate)\b/gi, tooltip: "Abacate | 70g = 120 kcal | C: 6g | P: 1g | G: 10g" },
    { match: /\b(banana)\b/gi, tooltip: "Banana | 1 un. = 90 kcal | C: 23g | P: 1g | G: 0g" },
    { match: /\b(ma[çc][ãa])\b/gi, tooltip: "Maçã | 1 un. = 70 kcal | C: 15g | P: 0g | G: 0g" }
  ];

  let elements: React.ReactNode[] = [text];

  rules.forEach(rule => {
    let newElements: React.ReactNode[] = [];
    elements.forEach(chunk => {
      if (typeof chunk === 'string') {
        const parts = chunk.split(rule.match);
        parts.forEach(part => {
          if (part.match(rule.match)) {
            newElements.push(
              <span 
                key={Math.random()} 
                title={rule.tooltip} 
                className="border-b border-dashed border-orange-400 text-orange-700 cursor-help transition-colors hover:bg-orange-100 rounded-sm px-[1px]"
              >
                {part}
              </span>
            );
          } else if (part) {
            newElements.push(part);
          }
        });
      } else {
        newElements.push(chunk);
      }
    });
    elements = newElements;
  });

  return elements;
};

// =========================================================================
// INTERFACES E FUNÇÕES DA LISTA DE MERCADO
// =========================================================================
interface ParsedIngredient {
  name: string;
  qty: number;
  unit: string;
  isTextOnly: boolean;
  original: string;
}

const parseDescription = (desc: string): ParsedIngredient[] => {
  if (!desc) return [];
  const parts = desc.split('+').map(s => s.trim());
  
  return parts.map(part => {
    const match = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    let name = part;
    let qty = 0;
    let unit = '';
    let isTextOnly = true;

    if (match) {
      name = match[1].trim();
      const qtyUnit = match[2] ? match[2].trim() : '';

      if (qtyUnit && !qtyUnit.toLowerCase().includes('vontade')) {
        const numMatch = qtyUnit.match(/^([\d.,]+)\s*(.*)$/);
        if (numMatch) {
          qty = parseFloat(numMatch[1].replace(',', '.'));
          unit = numMatch[2].trim();
          isTextOnly = false;
        } else {
          unit = qtyUnit; 
        }
      } else if (qtyUnit.toLowerCase().includes('vontade')) {
        unit = 'à vontade';
      }
    }
    return { name, qty, unit, isTextOnly, original: part };
  });
};

export default function MeuPlano() {
  const [planoPDF, setPlanoPDF] = useState<any>(null);
  const [mealPlanJSON, setMealPlanJSON] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketMultiplier, setMarketMultiplier] = useState<number>(7); 
  const [isCopied, setIsCopied] = useState(false);

  const [isSubstitutionsModalOpen, setIsSubstitutionsModalOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Usuário não autenticado.");
          setLoading(false);
          return;
        }

        const { data: settings } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (settings) {
          setPrices({
            premium: settings.premium_price || 297.00,
            mealPlan: settings.meal_plan_price || 147.00
          });
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        setProfile(profileData);
        
        const hasAccess = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
        setCanAccess(hasAccess);

        if (hasAccess) {
          if (profileData?.meal_plan && Array.isArray(profileData.meal_plan)) {
            setMealPlanJSON(profileData.meal_plan);
          }

          if (profileData?.meal_plan_pdf_url) {
            setPlanoPDF(profileData.meal_plan_pdf_url);
          }
        }
      } catch (err: any) {
        console.error("Erro no fetchData:", err);
        setError("Erro ao carregar seus dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  const handleUpgradeClick = async (planType: string) => {
    setProcessingCheckout(planType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: profile?.full_name || 'Paciente Vanusa Nutri',
          planType: planType 
        }),
      });

      const data = await response.json();
      if (data.init_point) window.location.href = data.init_point; 
      else throw new Error(data.error);
    } catch (error) {
      toast.error("Erro ao processar pagamento.");
      setProcessingCheckout(null);
    }
  };

  const filterTabs = useMemo(() => {
    if (!mealPlanJSON) return [];
    const days = new Set<string>();
    mealPlanJSON.forEach(meal => {
      meal.options?.forEach((opt: any) => {
        const d = opt.day?.trim();
        if (d && d.toLowerCase() !== 'todos os dias') days.add(d);
      });
    });
    return Array.from(days);
  }, [mealPlanJSON]);

  const filteredMeals = useMemo(() => {
    if (!mealPlanJSON) return [];
    if (selectedDayFilter === 'Todos') return mealPlanJSON;

    return mealPlanJSON.map(meal => {
      const filteredOptions = meal.options?.filter((opt: any) => {
        const optDay = opt.day?.trim();
        return optDay?.toLowerCase() === 'todos os dias' || optDay === selectedDayFilter;
      }) || [];
      return { ...meal, options: filteredOptions };
    }).filter(meal => meal.options.length > 0); 
  }, [mealPlanJSON, selectedDayFilter]);

  const marketList = useMemo(() => {
    if (!mealPlanJSON) return { measured: [], others: [] };
    const map = new Map<string, ParsedIngredient>();
    const textItems = new Set<string>();

    mealPlanJSON.forEach(meal => {
      if (meal.options && meal.options.length > 0) {
        const opt = meal.options[0]; 
        let localMultiplier = marketMultiplier;
        const dayStr = opt.day?.trim().toLowerCase();
        
        if (dayStr && dayStr !== 'todos os dias' && dayStr !== 'opção') {
          if (marketMultiplier === 7) localMultiplier = 1;
          else if (marketMultiplier === 15) localMultiplier = 2;
          else if (marketMultiplier === 30) localMultiplier = 4;
          else if (marketMultiplier === 1) localMultiplier = 0; 
        }

        const parsed = parseDescription(opt.description);
        parsed.forEach(ing => {
          if (ing.isTextOnly) {
            textItems.add(ing.original);
          } else {
            const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
            if (map.has(key)) {
              const existing = map.get(key)!;
              existing.qty += (ing.qty * localMultiplier);
            } else {
              map.set(key, { ...ing, qty: ing.qty * localMultiplier });
            }
          }
        });
      }
    });

    return {
      measured: Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name)),
      others: Array.from(textItems)
    };
  }, [mealPlanJSON, marketMultiplier]);

  // =========================================================================
  // GERAÇÃO DO TEXTO PARA WHATSAPP / CLIPBOARD
  // =========================================================================
  const generateShareText = () => {
    let periodText = 'Diário';
    if (marketMultiplier === 7) periodText = '7 Dias (Semanal)';
    if (marketMultiplier === 15) periodText = '15 Dias (Quinzenal)';
    if (marketMultiplier === 30) periodText = '30 Dias (Mensal)';

    const lines = [];

    lines.push(`\u{1F6D2} *Lista Mercado - Nutri Vanusa*`);
    lines.push(`\u{1F464} *Paciente:* ${profile?.full_name || 'Paciente'}`);
    lines.push(`\u{1F4C5} *Período:* ${periodText}`);
    lines.push('');

    if (marketList.measured.length > 0) {
      lines.push(`\u{1F4CA} *ITENS COM MEDIDA:*`);
      marketList.measured.forEach(item => {
        const qty = Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2));
        lines.push(`\u{2705} ${qty} ${item.unit} - ${item.name}`);
      });
      lines.push('');
    }

    if (marketList.others.length > 0) {
      lines.push(`\u{1F7E2} *CONSUMO LIVRE / OUTROS:*`);
      marketList.others.forEach(item => {
        lines.push(`\u{2705} ${item}`);
      });
      lines.push('');
    }

    lines.push(`\u{1F34E} *Foco! Você consegue!* \u{1F4AA}`);
    lines.push(`_Gerado pelo App Meu Plano Alimentar_`);

    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    const text = generateShareText().trim();
    const encodedText = encodeURIComponent(text);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile 
      ? 'https://api.whatsapp.com/send?text=' 
      : 'https://web.whatsapp.com/send?text=';

    const url = `${baseUrl}${encodedText}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = generateShareText();
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Lista copiada com sucesso!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      toast.error("Falha ao copiar lista.");
    }
  };

  // =========================================================================
  // GERAÇÃO DE PDF PAGINADO
  // =========================================================================
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = error => reject(error);
      img.src = imageUrl;
    });
  };

  const handleGenerateDynamicPDF = async () => {
    if (!mealPlanJSON) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const totalKcal = mealPlanJSON.reduce((acc, meal) => acc + (meal.options[0]?.kcal || 0), 0);

    const daysMap = new Map<string, any[]>();
    mealPlanJSON.forEach(meal => {
      meal.options.forEach((opt: any) => {
        const dayName = opt.day?.trim() || "Opção";
        if (!daysMap.has(dayName)) daysMap.set(dayName, []);
        daysMap.get(dayName)!.push({
          mealName: meal.name,
          time: meal.time,
          description: opt.description,
          kcal: opt.kcal
        });
      });
    });

    const dayOrder = ["Todos os dias", "Segunda a Sexta", "Finais de Semana", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
      let idxA = dayOrder.indexOf(a); let idxB = dayOrder.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    let logoBase64: string | null = null;
    try {
      logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png');
    } catch (error) {
      console.warn("Logo não encontrada em /images/logo-vanusa.png");
    }

    const printHeaderAndFooter = () => {
      let currentY = 20;
      
      if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, currentY - 6, 16, 16); 
      const textStartX = logoBase64 ? margin + 20 : margin;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(26, 58, 42); 
      doc.text("Vanusa Zacarias", textStartX, currentY + 2);
      doc.setFontSize(10);
      doc.setTextColor(139, 131, 120); 
      doc.text("NUTRIÇÃO CLÍNICA", textStartX, currentY + 8, { charSpace: 1.5 });
      doc.setFontSize(12);
      doc.setTextColor(200, 200, 200);
      doc.text("PLANO ALIMENTAR", pageWidth - margin, currentY + 8, { align: "right" });

      currentY += 18;
      doc.setDrawColor(26, 58, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("PACIENTE:", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(profile?.full_name || "Paciente", margin + 20, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("DATA:", margin + 85, currentY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(new Date().toLocaleDateString('pt-BR'), margin + 98, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("BASE DIÁRIA:", pageWidth - margin - 52, currentY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 88, 12); 
      doc.text(`~${totalKcal} kcal`, pageWidth - margin, currentY, { align: "right" });

      currentY += 6;
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 12;

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.", pageWidth / 2, pageHeight - 10, { align: "center" });

      return currentY;
    };

    sortedDays.forEach((day, index) => {
      if (index > 0) doc.addPage();
      let y = printHeaderAndFooter();

      doc.setFillColor(26, 58, 42); 
      doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255); 
      const titleText = day.toUpperCase() === 'TODOS OS DIAS' ? 'CARDÁPIO PADRÃO (TODOS OS DIAS)' : `CARDÁPIO: ${day.toUpperCase()}`;
      doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
      y += 20;

      const mealsForDay = daysMap.get(day) || [];
      mealsForDay.forEach(meal => {
        if (y > pageHeight - 40) { doc.addPage(); y = printHeaderAndFooter(); }

        doc.setFillColor(245, 248, 246); 
        doc.rect(margin, y - 6, pageWidth - (margin * 2), 10, 'F');
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 58, 42);
        doc.text(`${meal.mealName.toUpperCase()} - ${meal.time}`, margin + 3, y + 1);
        
        if (meal.kcal > 0) {
          doc.setFontSize(9);
          doc.setTextColor(234, 88, 12);
          doc.text(`~${meal.kcal} kcal`, pageWidth - margin - 3, y + 1, { align: "right" });
        }
        y += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const maxWidth = pageWidth - (margin * 2);
        const splitDesc = doc.splitTextToSize(meal.description, maxWidth);
        doc.text(splitDesc, margin + 3, y);
        y += (splitDesc.length * 5) + 6; 
      });
    });

    doc.save(`Plano_Alimentar_${profile?.full_name?.split(' ')[0] || 'Paciente'}.pdf`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  const hasAnyPlan = (mealPlanJSON && mealPlanJSON.length > 0) || !!planoPDF;
  const finalPdfUrl = typeof planoPDF === 'string' 
    ? planoPDF 
    : (planoPDF?.publicUrl || planoPDF?.file_url || planoPDF?.meal_plan_pdf_url || '#');

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-24 md:pt-32 relative">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        
        <nav className="flex items-center justify-between mb-12 animate-fade-in-up mt-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-colors font-bold text-sm bg-white px-5 py-2.5 rounded-full border border-stone-200 shadow-sm">
            <ChevronLeft size={18} /> Painel
          </Link>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Meu Plano Alimentar</span>
        </nav>

        {!canAccess ? (
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="text-stone-300" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-4">Acesso Bloqueado</h1>
            <p className="text-stone-500 text-sm mb-10 leading-relaxed">Seu cardápio personalizado já está disponível! Escolha uma opção para desbloquear agora mesmo.</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handleUpgradeClick('premium')} disabled={!!processingCheckout} className="w-full bg-nutri-900 text-white p-5 rounded-2xl font-bold flex flex-col items-center gap-1 hover:bg-nutri-800 transition-all shadow-xl shadow-nutri-900/20">
                <span className="flex items-center gap-2"><Star size={16} fill="currentColor" className="text-amber-400"/> Plano Premium Completo</span>
                <span className="text-xs font-medium opacity-80 italic">Desbloqueia App + Cardápio por R${prices.premium.toFixed(2)}</span>
              </button>
              <button onClick={() => handleUpgradeClick('meal_plan')} disabled={!!processingCheckout} className="w-full bg-white border-2 border-stone-100 text-stone-700 p-5 rounded-2xl font-bold hover:border-nutri-800 transition-all">
                Apenas Cardápio Interativo (R${prices.mealPlan.toFixed(2)})
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            <div className="mb-6">
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">O que comer hoje?</h1>
              <p className="text-stone-500 text-sm mt-1 font-medium">Siga as orientações da Nutri Vanusa para melhores resultados.</p>
            </div>

            {hasAnyPlan && filterTabs.length > 0 && (
              <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2 pt-2 animate-fade-in-up">
                <button
                  onClick={() => setSelectedDayFilter('Todos')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                    selectedDayFilter === 'Todos' 
                      ? 'bg-nutri-900 text-white shadow-md' 
                      : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Filter size={16} /> Visão Geral
                </button>
                {filterTabs.map(day => (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(day)}
                    className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                      selectedDayFilter === day 
                        ? 'bg-nutri-900 text-white shadow-md' 
                        : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}

            {!hasAnyPlan ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Utensils className="text-stone-300" size={24} />
                </div>
                <h3 className="font-bold text-stone-900">Plano em Elaboração</h3>
                <p className="text-stone-500 text-sm mt-2">A Nutri está montando seu cardápio personalizado. Você receberá uma notificação assim que estiver pronto!</p>
              </div>
            ) : (
              <>
                {/* BOTÕES DE AÇÕES (PDF, MERCADO, SUBSTITUIÇÕES) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in-up">
                  
                  {/* BOTÃO PDF INTELIGENTE */}
                  <button 
                    onClick={() => {
                      if (planoPDF && finalPdfUrl !== '#') {
                        window.open(finalPdfUrl, '_blank');
                      } else {
                        handleGenerateDynamicPDF();
                      }
                    }}
                    className="w-full flex flex-col justify-center text-left bg-nutri-900 text-white p-6 rounded-[2rem] shadow-xl shadow-nutri-900/20 hover:bg-nutri-800 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="bg-white/10 p-3 rounded-2xl text-white">
                        <FileText size={20} />
                      </div>
                      <div className="bg-white text-nutri-900 p-2 rounded-xl group-hover:-translate-y-1 transition-transform">
                        <Download size={16} />
                      </div>
                    </div>
                    <p className="font-bold text-lg mt-4 mb-0.5">Meu Cardápio</p>
                    <p className="text-xs text-nutri-100 font-medium">Baixar versão PDF</p>
                  </button>

                  {/* BOTÃO MERCADO */}
                  {mealPlanJSON && mealPlanJSON.length > 0 && (
                    <button 
                      onClick={() => setIsMarketModalOpen(true)}
                      className="w-full flex flex-col justify-center text-left bg-emerald-700 text-white p-6 rounded-[2rem] shadow-xl shadow-emerald-700/20 hover:bg-emerald-800 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="bg-white/10 p-3 rounded-2xl text-white">
                          <ShoppingCart size={20} />
                        </div>
                        <div className="bg-white text-emerald-700 p-2 rounded-xl group-hover:-translate-y-1 transition-transform">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="font-bold text-lg mt-4 mb-0.5">Lista de Mercado</p>
                      <p className="text-xs text-emerald-100 font-medium">Calcular compras</p>
                    </button>
                  )}

                  {/* BOTÃO SUBSTITUIÇÕES */}
                  {mealPlanJSON && mealPlanJSON.length > 0 && (
                    <button 
                      onClick={() => setIsSubstitutionsModalOpen(true)}
                      className="w-full flex flex-col justify-center text-left bg-orange-600 text-white p-6 rounded-[2rem] shadow-xl shadow-orange-600/20 hover:bg-orange-700 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="bg-white/10 p-3 rounded-2xl text-white">
                          <ArrowLeftRight size={20} />
                        </div>
                        <div className="bg-white text-orange-600 p-2 rounded-xl group-hover:-translate-y-1 transition-transform">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="font-bold text-lg mt-4 mb-0.5">Substituições</p>
                      <p className="text-xs text-orange-100 font-medium">Trocas inteligentes</p>
                    </button>
                  )}
                </div>

                {/* LISTAGEM DAS REFEIÇÕES INTERATIVAS */}
                {filteredMeals && filteredMeals.length > 0 && (
                  <div className="space-y-6">
                    {filteredMeals.map((refeicao: any, idx: number) => (
                      <div key={refeicao.id} className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="p-6 md:p-8">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                              <div className="bg-nutri-50 p-2.5 rounded-2xl text-nutri-800">
                                <Clock size={20} />
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase text-nutri-800 tracking-widest">{refeicao.time}</span>
                                <h3 className="text-xl font-bold text-stone-900">{refeicao.name}</h3>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {refeicao.options.map((opcao: any, oIdx: number) => (
                              <div key={opcao.id} className="bg-stone-50 p-5 rounded-2xl border border-stone-100 relative group">
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                  <span className={`text-[10px] border px-2 py-0.5 rounded font-black uppercase tracking-widest shadow-sm ${
                                    opcao.day?.toLowerCase() === 'todos os dias' 
                                      ? 'bg-nutri-50 border-nutri-100 text-nutri-800' 
                                      : 'bg-white border-stone-200 text-stone-800'
                                  }`}>
                                    {opcao.day || 'Opção'}
                                  </span>
                                  
                                  <div className="flex gap-1.5 flex-wrap ml-auto">
                                    {opcao.kcal > 0 && (
                                      <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
                                        ~{opcao.kcal} kcal
                                      </span>
                                    )}
                                    {opcao.carbo !== undefined && (
                                      <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Carboidratos">C: {opcao.carbo}g</span>
                                    )}
                                    {opcao.proteina !== undefined && (
                                      <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Proteínas">P: {opcao.proteina}g</span>
                                    )}
                                    {opcao.gordura !== undefined && (
                                      <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Gorduras">G: {opcao.gordura}g</span>
                                    )}
                                  </div>
                                </div>
                                
                                <p className="text-stone-700 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                                  {renderDescriptionWithTooltips(opcao.description)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {filteredMeals && filteredMeals.length === 0 && selectedDayFilter !== 'Todos' && (
                   <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 text-center">
                     <p className="text-stone-500 font-medium">Nenhuma refeição específica configurada para <b>{selectedDayFilter}</b>.</p>
                     <button onClick={() => setSelectedDayFilter('Todos')} className="mt-4 text-nutri-800 font-bold text-sm hover:underline">
                       Ver cardápio completo
                     </button>
                   </div>
                )}

                <div className="bg-stone-900 p-6 rounded-[2rem] text-white flex gap-4 items-start shadow-xl mt-8">
                  <div className="bg-white/10 p-2 rounded-xl shrink-0">
                    <Info size={20} className="text-stone-300" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">Dica de Sucesso</p>
                    <p className="text-xs text-stone-400 leading-relaxed">Você pode escolher qualquer uma das opções. Se tiver dúvida no preparo de algum alimento, passe o mouse (ou toque) nas <span className="border-b border-dashed border-orange-400 text-orange-400">palavras sublinhadas</span> no cardápio para ver as equivalências!</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DA LISTA DE MERCADO */}
      {isMarketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-6 bg-emerald-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-tight">Lista de Mercado</h3>
                  <p className="text-xs text-emerald-100 font-medium opacity-90">Opção 1 de cada refeição</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMarketModalOpen(false)} 
                className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filtro de Período */}
            <div className="bg-stone-50 border-b border-stone-200 p-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
                <CalendarDays size={14} /> Período de Compras
              </label>
              <div className="flex bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                {[
                  { label: 'Diário', val: 1 },
                  { label: '7 Dias', val: 7 },
                  { label: '15 Dias', val: 15 },
                  { label: 'Mês', val: 30 }
                ].map(tab => (
                  <button 
                    key={tab.val}
                    onClick={() => setMarketMultiplier(tab.val)}
                    className={`flex-1 py-3 text-xs font-bold transition-all ${
                      marketMultiplier === tab.val 
                        ? 'bg-emerald-700 text-white' 
                        : 'text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo da Lista */}
            <div className="p-6 overflow-y-auto bg-white flex-1 space-y-6">
              {marketList.measured.length === 0 && marketList.others.length === 0 ? (
                <div className="text-center py-10 text-stone-400">
                  <p>Não foi possível calcular a lista de mercado.</p>
                </div>
              ) : (
                <>
                  {marketList.measured.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-3 border-b border-stone-100 pb-2">Alimentos com Medidas</h4>
                      <ul className="space-y-3">
                        {marketList.measured.map((item, i) => (
                          <li key={i} className="flex justify-between items-center text-sm">
                            <span className="font-bold text-stone-700">{item.name}</span>
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold">
                              {Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2))} {item.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {marketList.others.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-3 border-b border-stone-100 pb-2">Outros / Consumo Livre</h4>
                      <ul className="space-y-2">
                        {marketList.others.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-stone-600 font-medium">
                            <span className="text-emerald-500 mt-0.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer com botões de Compartilhamento Premium */}
            {(marketList.measured.length > 0 || marketList.others.length > 0) && (
              <div className="p-4 border-t border-stone-100 bg-stone-50 flex gap-3">
                <button 
                  onClick={handleShareWhatsApp}
                  className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20 active:scale-[0.98]"
                >
                  <WhatsAppIcon size={20} />
                  <span>Enviar para WhatsApp</span>
                </button>
                
                <button 
                  onClick={handleCopyToClipboard}
                  className={`px-5 rounded-xl font-bold flex items-center justify-center transition-all border ${
                    isCopied 
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                  title="Copiar lista"
                >
                  {isCopied ? <CheckCheck size={20} /> : <Copy size={20} />}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL DE SUBSTITUIÇÕES (NOVO FORMATO VISUAL COM MACROS) */}
      {isSubstitutionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
            
            {/* Header Modal Substituições */}
            <div className="p-6 bg-orange-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <ArrowLeftRight size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-tight">Substituições</h3>
                  <p className="text-xs text-orange-100 font-medium opacity-90">Troque alimentos sem sair da dieta</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSubstitutionsModalOpen(false)} 
                className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Alerta de Dica */}
            <div className="bg-orange-50 p-4 border-b border-orange-100">
              <p className="text-xs text-orange-800 font-medium text-center flex items-center justify-center gap-2">
                <Info size={14} /> Os alimentos de cada lista possuem quantidades equivalentes.
              </p>
            </div>

            {/* Conteúdo da Lista de Equivalências */}
            <div className="p-6 overflow-y-auto bg-stone-50 flex-1 space-y-6">
              {SUBSTITUICOES_PADRAO.map((grupo, gIndex) => (
                <div key={gIndex} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                  <div className="mb-4 border-b border-stone-100 pb-3">
                    <h4 className="text-base font-bold text-stone-800">
                      {grupo.categoria}
                    </h4>
                    {grupo.referencia && (
                      <p className="text-xs text-stone-500 font-medium mt-1">
                        {grupo.referencia.descricao}
                      </p>
                    )}
                  </div>
                  
                  <ul className="space-y-3">
                    {grupo.itens.map((item, iIndex) => (
                      <li key={iIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="flex flex-col">
                          <span className="font-bold text-stone-700 text-sm">{item.nome}</span>
                          <span className="text-orange-600 font-bold text-xs mt-0.5">{item.medida}</span>
                        </div>
                        
                        {item.macros && (
                          <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                            <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
                              {item.macros.kcal} kcal
                            </span>
                            <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Carboidratos">
                              C: {item.macros.carbo}g
                            </span>
                            <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Proteínas">
                              P: {item.macros.proteina}g
                            </span>
                            <span className="bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title="Gorduras">
                              G: {item.macros.gordura}g
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-200 bg-white flex justify-center">
              <p className="text-xs text-stone-400 font-medium text-center">
                Dúvidas sobre outros alimentos? Envie uma mensagem no WhatsApp.
              </p>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}