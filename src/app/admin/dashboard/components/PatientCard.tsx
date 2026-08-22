'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Edit2, Activity, 
  MoreHorizontal, AlertCircle, Bell, BellRing, Star, FileText, Trash2,
  MessageCircle, Utensils, TrendingUp, CheckCircle, CheckCircle2, X, Eye, Save,
  Calendar, Weight, User, ClipboardList, ChevronRight, AlertTriangle, Zap, Clock
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn, createRippleEffect, ui } from '@/ui/system';
import { Patient, PatientScore } from '../types';

interface PatientCardProps {
  patient: Patient & { score: PatientScore };
  usage: number;
  isDietReady: boolean;
  onOpenDietBuilder: (p: Patient) => void;
  onOpenEvalModal: (p: Patient) => void;
  onOpenClinicalModal: (p: Patient) => void;
  onEditProfile: (p: Patient) => void;
  onDeleteDiet: (id: string) => void;
  onGeneratePDF: (p: Patient) => void;
  onAutoReminder?: (patientId: string, phone: string) => void;
  isEditing?: boolean;
  editFormData?: {
    data_nascimento: string;
    sexo: string;
    tipo_perfil: string;
    meta_peso: string;
    account_type: string;
  };
  onEditFormChange?: (field: string, value: string) => void;
  onSaveProfile?: () => void;
  onCancelEdit?: () => void;
}

const priorityConfig = {
  CRITICAL: {
    label: 'CRÍTICO',
    icon: AlertTriangle,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/50 ring-2 ring-rose-400/40 bg-rose-50/30 dark:bg-rose-950/10'
  },
  HIGH: {
    label: 'ALTO RISCO',
    icon: AlertCircle,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800/50'
  },
  MEDIUM: {
    label: 'ATENÇÃO',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50'
  },
  LOW: {
    label: 'ESTÁVEL',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50'
  }
};

export function PatientCard({
  patient,
  usage,
  isDietReady,
  onOpenDietBuilder,
  onOpenEvalModal,
  onOpenClinicalModal,
  onEditProfile,
  onDeleteDiet,
  onGeneratePDF,
  onAutoReminder,
  isEditing = false,
  editFormData,
  onEditFormChange,
  onSaveProfile,
  onCancelEdit
}: PatientCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  const config = priorityConfig[patient.score.risk];
  const score = patient.score;
  
  useEffect(() => {
    if (!hasAnimated && (score.risk === 'CRITICAL' || score.risk === 'HIGH')) {
      // setState deferido (requestAnimationFrame) para não disparar
      // react-hooks/set-state-in-effect (cascading renders)
      const raf = requestAnimationFrame(() => setHasAnimated(true));
      const timer = setTimeout(() => setHasAnimated(false), 1000);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [score.risk, hasAnimated]);
  
  const getScoreIcon = () => {
    if (score.total >= 70) return <CheckCircle size={12} className="text-emerald-500" />;
    if (score.total >= 40) return <TrendingUp size={12} className="text-amber-500" />;
    return <AlertCircle size={12} className="text-rose-500" />;
  };
  
  const getScoreColor = () => {
    if (score.total >= 70) return 'text-emerald-600';
    if (score.total >= 40) return 'text-amber-600';
    return 'text-rose-600';
  };
  
  // Modo de edição
  if (isEditing && editFormData && onEditFormChange && onSaveProfile && onCancelEdit) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-stone-900 rounded-2xl border border-nutri-200 dark:border-nutri-800 shadow-lg p-4"
      >
        <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-2 mb-3">
          <h4 className="font-bold text-stone-800 dark:text-stone-200 text-sm">Editar Perfil</h4>
          <button onClick={onCancelEdit} className="p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors">
            <X size={14} />
          </button>
        </div>
        
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={10} /> Nascimento
            </label>
            <input
              type="date"
              className={cn(ui.input, 'h-8 text-xs px-2 mt-1')}
              value={editFormData.data_nascimento}
              onChange={e => onEditFormChange('data_nascimento', e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <User size={10} /> Sexo
            </label>
            <select
              className={cn(ui.input, 'h-8 text-xs px-2 mt-1')}
              value={editFormData.sexo}
              onChange={e => onEditFormChange('sexo', e.target.value)}
            >
              <option value="">Selecionar</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <ClipboardList size={10} /> Perfil Clínico
            </label>
            <select
              className={cn(ui.input, 'h-8 text-xs px-2 mt-1')}
              value={editFormData.tipo_perfil}
              onChange={e => onEditFormChange('tipo_perfil', e.target.value)}
            >
              <option value="adulto">Adulto</option>
              <option value="atleta">Atleta</option>
              <option value="crianca">Criança</option>
              <option value="idoso">Idoso</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <Weight size={10} /> Meta (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Ex: 65.5"
              className={cn(ui.input, 'h-8 text-xs px-2 mt-1')}
              value={editFormData.meta_peso}
              onChange={e => onEditFormChange('meta_peso', e.target.value)}
            />
          </div>
          
          <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100/50">
            <label className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Star size={10} /> Nível de Acesso
            </label>
            <select
              className="w-full h-7 text-[9px] px-2 border border-emerald-200 bg-white rounded-md font-semibold"
              value={editFormData.account_type}
              onChange={e => onEditFormChange('account_type', e.target.value)}
            >
              <option value="free">Básico (Free)</option>
              <option value="premium">Premium (PRO)</option>
            </select>
          </div>
          
          <button onClick={onSaveProfile} className={cn(ui.buttonPrimary, 'w-full h-8 rounded-lg text-xs mt-2')}>
            <Save size={12} /> Salvar alterações
          </button>
        </div>
      </motion.div>
    );
  }
  
  // Modo normal de exibição
  return (
    <motion.div
      id={`patient-${patient.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: hasAnimated ? [1, 1.02, 1] : 1
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative rounded-2xl transition-all duration-300 cursor-pointer',
        'bg-white dark:bg-stone-900',
        'border',
        config.border,
        'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.action-button, .menu-button, .edit-button')) return;
        router.push(`/admin/paciente/${patient.id}/historico`);
      }}
    >
      {/* Efeito vidro */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Barra de status */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1 rounded-t-2xl',
        score.risk === 'CRITICAL' ? 'bg-rose-400' :
        score.risk === 'HIGH' ? 'bg-orange-400' :
        score.risk === 'MEDIUM' ? 'bg-amber-400' : 'bg-emerald-400'
      )} />
      
      {/* Indicador pulsante para críticos */}
      {score.risk === 'CRITICAL' && (
        <>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
        </>
      )}
      
      <div className="p-4 relative z-10">
        {/* Header: Status + Score + Ações discretas + Menu */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0', config.bg, config.color)}>
              <config.icon size={10} />
              <span>{config.label}</span>
            </div>
            
            {/* Score (breakdown em tooltip) */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[9px] font-bold cursor-help"
              title={`Engajamento ${score.engagement} · Recência ${score.recency} · Adesão ${score.adherence}`}
            >
              {getScoreIcon()}
              <span className={cn('font-mono', getScoreColor())}>{score.total}</span>
              <span className="text-stone-400 text-[8px]">/100</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pill de cobrança discreta (só para quem precisa) */}
            {(score.risk === 'CRITICAL' || score.risk === 'HIGH') && patient.phone && (
              <a
                href={`https://wa.me/55${patient.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(score.risk === 'CRITICAL' ? 'Olá! Seu acompanhamento está pendente. Vamos retomar?' : 'Olá! Sentimos sua falta. Como está o acompanhamento?')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAutoReminder) onAutoReminder(patient.id, patient.phone!);
                }}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold border transition-all active:scale-[0.95]',
                  score.risk === 'CRITICAL'
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                    : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                )}
                title={score.suggestedAction}
              >
                <BellRing size={9} /> {score.risk === 'CRITICAL' ? 'Cobrar' : 'Reengajar'}
              </a>
            )}

            {/* Menu ⋯ */}
            <div className="relative menu-button">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Mais ações"
              >
                <MoreHorizontal size={16} />
              </button>
              
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-100 dark:border-stone-700 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEditProfile(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Edit2 size={12} /> Editar perfil
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenEvalModal(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Eye size={12} /> Ver avaliação
                    </button>
                    
                    {/* Cobrar via WhatsApp (acessível a todos) */}
                    {patient.phone && (
                      <a
                        href={`https://wa.me/55${patient.phone?.replace(/\D/g, '')}?text=Olá! Seu acompanhamento está pendente. Vamos retomar?`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      >
                        <BellRing size={12} /> Cobrar via WhatsApp
                      </a>
                    )}
                    
                    {isDietReady && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onGeneratePDF(patient);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      >
                        <FileText size={12} /> Baixar PDF da dieta
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenClinicalModal(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Activity size={12} /> Dados clínicos
                    </button>
                    
                    {/* Upgrade premium (movido para o menu) */}
                    {patient.account_type !== 'premium' && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          toast.info('🔒 Upgrade para Premium', {
                            description: 'Desbloqueie análises avançadas, histórico completo e recomendações automáticas.',
                            duration: 8000,
                            action: {
                              label: 'Quero Upgrade',
                              onClick: () => toast.success('Em breve! Link de pagamento será enviado.')
                            }
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <Star size={12} /> Liberar Premium
                      </button>
                    )}
                    
                    {isDietReady && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDeleteDiet(patient.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-t border-stone-100 dark:border-stone-700"
                      >
                        <Trash2 size={12} /> Excluir dieta
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        
        {/* Nome + PRO (sem caneta: editar perfil está no menu ⋯) */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Link href={`/admin/paciente/${patient.id}/historico`} className="group flex-1 min-w-0">
            <h3 className={cn(ui.textCardTitle, 'truncate group-hover:text-nutri-600 transition-colors')}>
              {patient.full_name || 'Sem nome'}
            </h3>
          </Link>
          {patient.account_type === 'premium' && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md shrink-0">
              <Star size={10} className="fill-amber-500" /> PRO
            </span>
          )}
        </div>
        
        {/* Badges de estado (Dieta/Pendente + NOVO + AUSENTE + msgs) */}
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {/* Identidade visual: esmeralda = dieta PRONTA | âmbar = PENDENTE */}
          <span className={cn(
            ui.badge, ui.textCardBadge, 'text-[8px] py-0.5 px-1.5 gap-1',
            isDietReady
              ? 'bg-emerald-600 text-white border border-emerald-700 shadow-sm shadow-emerald-700/30'
              : 'bg-amber-500 text-white border border-amber-600 shadow-sm shadow-amber-600/30'
          )}>
            {isDietReady ? <CheckCircle2 size={8} className="shrink-0" /> : <Clock size={8} className="shrink-0" />}
            {isDietReady ? 'Dieta' : 'Pendente'}
          </span>
          {patient.is_new && (
            <span className={cn(ui.badge, ui.badgeInfo, ui.textCardBadge, 'text-[8px] py-0.5 px-1')}>
              <Bell size={7} className="inline mr-0.5 animate-pulse" /> NOVO
            </span>
          )}
          {patient.is_late && (
            <span className={cn(ui.badge, ui.badgeWarning, ui.textCardBadge, 'text-[8px] py-0.5 px-1')}>
              <AlertCircle size={7} className="inline mr-0.5" /> AUSENTE
            </span>
          )}
          <span className={cn(ui.badge, ui.badgeNeutral, ui.textCardBadge, 'text-[8px] py-0.5 px-1 flex items-center gap-0.5')}>
            <MessageCircle size={7} /> {usage} {usage === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
        <p className={cn(ui.textCardMeta, 'text-[8px] mb-2')}>
          {patient.is_late ? 'Última interação: +7 dias' : patient.is_new ? 'Ativo agora' : 'Ativo hoje'}
        </p>
        
        {/* Meta e Perfil */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-md text-center">
            <p className={cn(ui.textCardMeta, 'text-[7px] uppercase font-bold')}>Meta</p>
            <p className={cn(ui.textCardSub, 'text-[11px] font-bold')}>
              {patient.meta_peso ? `${patient.meta_peso} kg` : 'Não definida'}
            </p>
          </div>
          <div className="bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-md text-center">
            <p className={cn(ui.textCardMeta, 'text-[7px] uppercase font-bold')}>Perfil</p>
            <p className={cn(ui.textCardSub, 'text-[11px] font-semibold capitalize')}>
              {patient.tipo_perfil || 'Não definido'}
            </p>
          </div>
        </div>
        
        {/* Preview da Avaliação (Inicial + QFA + Alergias) */}
        {patient.evaluation_answers && Object.keys(patient.evaluation_answers).length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenEvalModal(patient); }}
            className="action-button w-full flex items-center justify-between bg-stone-50 dark:bg-stone-800/30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all p-1.5 rounded-md mb-3 group text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-nutri-600 dark:text-nutri-400 text-[8px] uppercase tracking-wider flex items-center gap-0.5">
                <Eye size={9} /> Inicial + QFA + Alergias
              </p>
              <p className="line-clamp-1 text-[9px] font-medium text-stone-500 dark:text-stone-400 italic truncate">
                &ldquo;{String(Object.values(patient.evaluation_answers)[0] || '').substring(0, 45)}...&rdquo;
              </p>
            </div>
            <ChevronRight size={12} className="text-nutri-400 group-hover:text-nutri-600 transition-colors shrink-0" />
          </button>
        ) : (
          <div className="text-center py-1.5 mb-3 bg-stone-50 dark:bg-stone-800/30 rounded-md">
            <FileText size={10} className="inline text-stone-300 mr-0.5" />
            <span className={cn(ui.textCardMeta, 'text-[9px]')}>Sem avaliação</span>
          </div>
        )}
        
        {/* CTA PRIMÁRIO: Dieta/Editar (identidade: esmeralda = pronta | âmbar = pendente) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            createRippleEffect(e);
            onOpenDietBuilder(patient);
          }}
          className={cn(
            'action-button w-full',
            isDietReady ? ui.buttonPrimarySuccess : ui.buttonPrimaryWarning,
            'h-10 md:h-11 rounded-xl text-sm font-bold shadow-lg'
          )}
        >
          {isDietReady ? <CheckCircle2 size={15} /> : <Utensils size={15} />}
          {isDietReady ? 'Editar dieta' : 'Montar dieta'}
        </button>
        
        {/* LINHA DE AÇÕES SECUNDÁRIAS (forma uniforme via ui.buttonSecondary) */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800">
          {/* Botão PDF */}
          {isDietReady && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                createRippleEffect(e);
                onGeneratePDF(patient);
              }}
              className={cn('action-button', ui.buttonSecondary, ui.buttonSecondaryNeutral)}
              title="Gerar PDF da dieta"
            >
              <FileText size={11} /> PDF
            </button>
          )}

          {/* Botão Clínico */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenClinicalModal(patient);
            }}
            className={cn('action-button', ui.buttonSecondary, ui.buttonSecondaryInfo)}
            title="Dados clínicos"
          >
            <Activity size={11} /> Clínico
          </button>

          {/* Botão Zap (WhatsApp) */}
          <a
            href={`https://wa.me/55${patient.phone?.replace(/\D/g, '')}?text=Olá!`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(ui.buttonSecondary, ui.buttonSecondaryWhatsapp)}
            title="Conversar no WhatsApp"
          >
            <MessageCircle size={11} /> Zap
          </a>
        </div>
      </div>
    </motion.div>
  );
}