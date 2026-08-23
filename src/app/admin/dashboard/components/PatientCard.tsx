'use client';

import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit2, Activity, 
  MoreHorizontal, AlertCircle, Bell, BellRing, Star, FileText, Trash2,
  MessageCircle, Utensils, TrendingUp, CheckCircle, CheckCircle2, X, Eye, Save,
  Calendar, Weight, User, ClipboardList, AlertTriangle, Zap, Clock
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
  const [showMenu, setShowMenu] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [chargeHandled, setChargeHandled] = useState(false);
  const [chargeSending, setChargeSending] = useState(false);
  
  const config = priorityConfig[patient.score.risk];
  const score = patient.score;
  const chargeStorageKey = `admin-charge:${patient.id}`;
  
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

  useEffect(() => {
    try {
      setChargeHandled(localStorage.getItem(chargeStorageKey) === '1');
    } catch {
      setChargeHandled(false);
    }
  }, [chargeStorageKey]);
  
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

  const recencyLabel =
    patient.days_since_last === null || patient.days_since_last === undefined
      ? 'Sem recência registrada'
      : patient.days_since_last <= 1
        ? 'Ativo hoje'
        : `Sem atividade há ${patient.days_since_last} dia${patient.days_since_last === 1 ? '' : 's'}`;

  const evaluationLabel =
    patient.evaluation_answers && Object.keys(patient.evaluation_answers).length > 0
      ? 'Avaliação pronta'
      : 'Sem avaliação inicial';

  const primaryStatusLabel = isDietReady ? 'Dieta pronta' : 'Plano pendente';
  const chargeLabel = chargeHandled
    ? 'Cobrado hoje'
    : score.risk === 'CRITICAL'
      ? 'Cobrar'
      : 'Reengajar';

  const handleChargeAction = async (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (chargeSending) return;

    const phone = patient.phone?.replace(/\D/g, '');
    const message = score.risk === 'CRITICAL'
      ? 'Olá! Seu acompanhamento está pendente. Vamos retomar?'
      : 'Olá! Sentimos sua falta. Como está o acompanhamento?';

    setChargeSending(true);
    try {
      if (phone) {
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        onAutoReminder?.(patient.id, patient.phone!);
      } else {
        toast.info('Paciente sem telefone cadastrado.', {
          description: 'A cobrança foi marcada apenas no painel.',
        });
      }

      try {
        localStorage.setItem(chargeStorageKey, '1');
      } catch {}

      window.dispatchEvent(
        new CustomEvent('admin-charge-updated', {
          detail: { patientId: patient.id },
        })
      );

      setChargeHandled(true);
      toast.success('Cobrança marcada como concluída.');
    } finally {
      setChargeSending(false);
    }
  };

  // Modo normal de exibição
  return (
    <motion.div
      id={`patient-${patient.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: hasAnimated ? [1, 1.02, 1] : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-3xl border bg-white dark:bg-stone-900 transition-all duration-300 cursor-default',
        config.border,
        'hover:shadow-xl'
      )}
    >
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-white/5 via-transparent to-amber-50/20 pointer-events-none" />

      <div className={cn(
        'absolute top-0 left-0 right-0 h-1 rounded-t-3xl',
        score.risk === 'CRITICAL' ? 'bg-rose-400' :
        score.risk === 'HIGH' ? 'bg-orange-400' :
        score.risk === 'MEDIUM' ? 'bg-amber-400' : 'bg-emerald-400'
      )} />

      {score.risk === 'CRITICAL' && (
        <>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
        </>
      )}

      <div className="p-4 md:p-5 relative z-10">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 border', config.bg, config.color)}>
                <config.icon size={10} />
                <span>{config.label}</span>
              </div>
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-bold cursor-help border border-stone-200 dark:border-stone-700"
                title={`Engajamento ${score.engagement} · Recência ${score.recency} · Adesão ${score.adherence}`}
              >
                {getScoreIcon()}
                <span className={cn('font-mono', getScoreColor())}>{score.total}</span>
                <span className="text-stone-400 text-[8px]">/100</span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <Link href={`/admin/paciente/${patient.id}/historico`} className="group/name inline-flex min-w-0">
                  <h3 className={cn(ui.textCardTitle, 'truncate group-hover/name:text-nutri-600 transition-colors')}>
                    {patient.full_name || 'Sem nome'}
                  </h3>
                </Link>
                <p className="mt-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  {patient.tipo_perfil || 'Perfil não definido'}
                  {patient.meta_peso ? ` · Meta ${patient.meta_peso} kg` : ''}
                  {patient.account_type === 'premium' ? ' · PRO' : ''}
                </p>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(score.risk === 'CRITICAL' || score.risk === 'HIGH') && patient.phone && (
              chargeHandled ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-bold border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  title="Cobrança registrada"
                >
                  <CheckCircle2 size={9} /> Cobrado hoje
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleChargeAction}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-bold border transition-all active:scale-[0.95]',
                    score.risk === 'CRITICAL'
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                      : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                  )}
                  title={score.suggestedAction}
                >
                  <BellRing size={9} /> {chargeLabel}
                </button>
              )
            )}

            <div className="relative menu-button">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
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
                    className="absolute right-0 top-8 z-20 w-52 bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-100 dark:border-stone-700 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEditProfile(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Edit2 size={12} /> Editar perfil
                    </button>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenEvalModal(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Eye size={12} /> Ver avaliação
                    </button>

                    {patient.phone && (
                      <button
                        type="button"
                        onClick={handleChargeAction}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors text-left"
                      >
                        <BellRing size={12} /> {chargeHandled ? 'Cobrado hoje' : 'Cobrar via WhatsApp'}
                      </button>
                    )}

                    {isDietReady && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onGeneratePDF(patient);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                      >
                        <FileText size={12} /> Baixar PDF da dieta
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenClinicalModal(patient);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Activity size={12} /> Dados clínicos
                    </button>

                    {patient.account_type !== 'premium' && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          toast.info('🔒 Upgrade para Premium', {
                            description: 'Desbloqueie análises avançadas, histórico completo e recomendações automáticas.',
                            duration: 8000,
                            action: {
                              label: 'Quero Upgrade',
                              onClick: () => toast.success('Em breve! Link de pagamento será enviado.'),
                            },
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
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
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-t border-stone-100 dark:border-stone-700"
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

        <div className="rounded-2xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/30 p-3 md:p-4 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400 mb-1">
                {chargeHandled ? 'Cobrança concluída' : 'Próxima ação'}
              </p>
              <p className="text-sm md:text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
                {chargeHandled ? 'Contato já registrado no painel' : score.suggestedAction}
              </p>
              <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                {recencyLabel}
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-2 text-right">
              <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">Status</p>
              <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200">{primaryStatusLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={cn(
            ui.badge,
            ui.textCardBadge,
            'text-[8px] py-0.5 px-1.5 gap-1',
            isDietReady
              ? 'bg-emerald-600 text-white border border-emerald-700 shadow-sm shadow-emerald-700/30'
              : 'bg-amber-500 text-white border border-amber-600 shadow-sm shadow-amber-600/30'
          )}>
            {isDietReady ? <CheckCircle2 size={8} className="shrink-0" /> : <Clock size={8} className="shrink-0" />}
            {primaryStatusLabel}
          </span>

          <span className={cn(ui.badge, ui.badgeNeutral, ui.textCardBadge, 'text-[8px] py-0.5 px-1 flex items-center gap-0.5')}>
            <MessageCircle size={7} /> {usage} {usage === 1 ? 'msg' : 'msgs'}
          </span>

          <span className={cn(ui.badge, patient.evaluation_answers && Object.keys(patient.evaluation_answers).length > 0 ? ui.badgeInfo : ui.badgeNeutral, ui.textCardBadge, 'text-[8px] py-0.5 px-1')}>
            <Eye size={7} className="inline mr-0.5" /> {evaluationLabel}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            createRippleEffect(e);
            onOpenDietBuilder(patient);
          }}
          className={cn(
            'action-button w-full',
            isDietReady ? ui.buttonPrimarySuccess : ui.buttonPrimaryWarning,
            'h-10 md:h-11 rounded-2xl text-sm font-bold shadow-lg'
          )}
        >
          {isDietReady ? <CheckCircle2 size={15} /> : <Utensils size={15} />}
          {isDietReady ? 'Editar dieta' : 'Montar dieta'}
        </button>

        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800">
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

        <p className="mt-3 text-[10px] font-medium text-stone-400 dark:text-stone-500">
          Abra o histórico pelo nome do paciente.
        </p>
      </div>
    </motion.div>
  );
}
