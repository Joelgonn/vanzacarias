'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Edit2, Activity, Target, Users, 
  MoreHorizontal, AlertCircle, Bell, BellRing, Star, FileText, Trash2,
  MessageCircle, Utensils, TrendingUp, CheckCircle, X, Eye, Save,
  Calendar, Weight, User, ClipboardList, AlertTriangle
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
    label: '🚨 CRÍTICO',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/50 ring-2 ring-rose-400/40 bg-rose-50/30 dark:bg-rose-950/10',
    cta: { label: '💰 Cobrar agora', icon: BellRing, style: 'bg-rose-500 hover:bg-rose-600' }
  },
  HIGH: {
    label: '⚠️ ALTO RISCO',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800/50',
    cta: { label: '📞 Reengajar', icon: Bell, style: 'bg-orange-500 hover:bg-orange-600' }
  },
  MEDIUM: {
    label: '⚡ ATENÇÃO',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    cta: { label: '🍽️ Montar dieta', icon: Utensils, style: 'bg-amber-500 hover:bg-amber-600' }
  },
  LOW: {
    label: '✅ ESTÁVEL',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    cta: { label: '📋 Acompanhar', icon: Users, style: 'bg-emerald-500 hover:bg-emerald-600' }
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
      setHasAnimated(true);
      const timer = setTimeout(() => setHasAnimated(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [score.risk, hasAnimated]);
  
  const getScoreIcon = () => {
    if (score.total >= 70) return <CheckCircle size={12} className="text-emerald-500" />;
    if (score.total >= 40) return <TrendingUp size={12} className="text-amber-500" />;
    return <AlertCircle size={12} className="text-rose-500" />;
  };
  
  const getPrimaryAction = () => {
    if (score.risk === 'CRITICAL') {
      return {
        label: '💰 Cobrar agora',
        action: () => {
          const phone = patient.phone?.replace(/\D/g, '');
          if (phone) {
            if (onAutoReminder) onAutoReminder(patient.id, phone);
            window.open(`https://wa.me/55${phone}?text=Olá! Seu acompanhamento está pendente. Vamos retomar?`, '_blank');
          } else {
            toast.warning('Número não cadastrado');
          }
        },
        icon: BellRing
      };
    }
    if (score.risk === 'HIGH') {
      return {
        label: '📞 Reengajar',
        action: () => {
          const phone = patient.phone?.replace(/\D/g, '');
          if (phone) {
            window.open(`https://wa.me/55${phone}?text=Olá! Sentimos sua falta. Como está o acompanhamento?`, '_blank');
          } else {
            toast.warning('Número não cadastrado');
          }
        },
        icon: Bell
      };
    }
    if (score.risk === 'MEDIUM' || !isDietReady) {
      return {
        label: '🍽️ Montar dieta',
        action: () => onOpenDietBuilder(patient),
        icon: Utensils
      };
    }
    return {
      label: '📋 Abrir prontuário',
      action: () => router.push(`/admin/paciente/${patient.id}/historico`),
      icon: Users
    };
  };
  
  const primaryAction = getPrimaryAction();
  const PrimaryIcon = primaryAction.icon;
  
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
        {/* Header: Status + Score + Menu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold', config.bg, config.color)}>
              <span>{config.label}</span>
            </div>
            
            {/* Score */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[9px] font-bold">
              {getScoreIcon()}
              <span className={cn('font-mono', getScoreColor())}>{score.total}</span>
              <span className="text-stone-400 text-[8px]">/100</span>
            </div>
          </div>
          
          {/* Menu ⋯ */}
          <div className="relative menu-button">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-100 dark:border-stone-700 overflow-hidden"
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
                  
                  {isDietReady && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteDiet(patient.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 size={12} /> Excluir dieta
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Nome + Badge Premium + Badge de Mensagens (ao lado do nome, como era antes) */}
        <div className="flex items-center justify-between mb-2">
          <Link href={`/admin/paciente/${patient.id}/historico`} className="group flex-1">
            <h3 className="font-black text-base tracking-tight text-stone-900 dark:text-white group-hover:text-nutri-600 transition-colors">
              {patient.full_name || 'Sem nome'}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5">
            {/* Badge de mensagens - exatamente como era antes */}
            <span className={cn(ui.badge, ui.badgeNeutral, 'text-[9px] py-0.5 px-1.5 flex items-center gap-1')}>
              <MessageCircle size={9} />
              {usage} {usage === 1 ? 'msg' : 'msgs'}
            </span>
            {patient.account_type === 'premium' && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">
                <Star size={10} className="fill-amber-500" /> PRO
              </span>
            )}
          </div>
        </div>
        
        {/* Meta e Perfil */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-md text-center">
            <p className="text-[7px] text-stone-400 uppercase font-bold">Meta</p>
            <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
              {patient.meta_peso ? `${patient.meta_peso} kg` : 'Não definida'}
            </p>
          </div>
          <div className="bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-md text-center">
            <p className="text-[7px] text-stone-400 uppercase font-bold">Perfil</p>
            <p className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 capitalize">
              {patient.tipo_perfil || 'Não definido'}
            </p>
          </div>
        </div>
        
        {/* Score Breakdown */}
        <div className="mb-3 p-2 bg-stone-50 dark:bg-stone-800/30 rounded-lg">
          <div className="flex justify-between text-[8px] text-stone-500 mb-1">
            <span>Engajamento</span>
            <span>Recência</span>
            <span>Adesão</span>
          </div>
          <div className="flex gap-1 h-1.5">
            <div className="flex-1 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full bg-nutri-400 rounded-full" style={{ width: `${score.engagement}%` }} />
            </div>
            <div className="flex-1 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${score.recency}%` }} />
            </div>
            <div className="flex-1 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${score.adherence}%` }} />
            </div>
          </div>
        </div>
        
        {/* Recomendação Automática */}
        <div className="mb-3 p-1.5 bg-nutri-50 dark:bg-nutri-950/30 rounded-lg border border-nutri-100 dark:border-nutri-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]">🤖</span>
            <span className="text-[9px] font-medium text-nutri-700 dark:text-nutri-300">
              Recomendação:
            </span>
            <span className="text-[9px] font-bold text-stone-700 dark:text-stone-300">
              {score.suggestedAction}
            </span>
          </div>
        </div>
        
        {/* CTA Principal */}
        <button
          onClick={(e) => {
            createRippleEffect(e);
            primaryAction.action();
          }}
          className={cn(
            'action-button w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200',
            'flex items-center justify-center gap-2',
            'hover:scale-[1.02] active:scale-[0.97]',
            config.cta.style,
            'text-white shadow-lg'
          )}
        >
          <PrimaryIcon size={14} />
          {primaryAction.label}
        </button>
        
        {/* Botão WhatsApp direto */}
        <a
          href={`https://wa.me/55${patient.phone?.replace(/\D/g, '')}?text=Olá!`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-medium bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle size={10} /> WhatsApp
        </a>
        
        {/* Upgrade para não-premium */}
        {patient.account_type !== 'premium' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.info('🔒 Upgrade para Premium', {
                description: 'Desbloqueie análises avançadas, histórico completo e recomendações automáticas.',
                duration: 8000,
                action: {
                  label: 'Quero Upgrade',
                  onClick: () => toast.success('Em breve! Link de pagamento será enviado.')
                }
              });
            }}
            className="mt-2 w-full py-1 rounded-lg text-[8px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
          >
            <Star size={9} />
            🔒 Liberar Premium
          </button>
        )}
      </div>
    </motion.div>
  );
}