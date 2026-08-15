'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Users, FilterX, Bell, TrendingUp, AlertTriangle } from 'lucide-react';
import { PatientCard } from './PatientCard';
import { cn } from '@/ui/system';
import { Patient, PatientScore } from '../types';

interface PatientGridProps {
  patients: (Patient & { score: PatientScore })[];
  usageStats: Record<string, number>;
  editingId: string | null;
  editFormData: {
    data_nascimento: string;
    sexo: string;
    tipo_perfil: string;
    meta_peso: string;
    account_type: string;
  };
  onOpenDietBuilder: (p: Patient) => void;
  onOpenEvalModal: (p: Patient) => void;
  onOpenClinicalModal: (p: Patient) => void;
  onEditProfile: (p: Patient) => void;
  onDeleteDiet: (id: string) => void;
  onGeneratePDF: (p: Patient) => void;
  onClearFilters?: () => void;
  onAutoReminder?: (patientId: string, phone: string) => void;
  onEditFormChange: (field: string, value: string) => void;
  onSaveProfile: () => void;
  onCancelEdit: () => void;
}

export function PatientGrid({
  patients,
  usageStats,
  editingId,
  editFormData,
  onOpenDietBuilder,
  onOpenEvalModal,
  onOpenClinicalModal,
  onEditProfile,
  onDeleteDiet,
  onGeneratePDF,
  onClearFilters,
  onAutoReminder,
  onEditFormChange,
  onSaveProfile,
  onCancelEdit
}: PatientGridProps) {
  
  const criticalPatients = patients.filter(p => p.score.risk === 'CRITICAL');
  const highPatients = patients.filter(p => p.score.risk === 'HIGH');
  const mediumPatients = patients.filter(p => p.score.risk === 'MEDIUM');
  const lowPatients = patients.filter(p => p.score.risk === 'LOW');
  
  const sections = [
    { 
      title: '🚨 Críticos', 
      patients: criticalPatients, 
      color: 'rose',
      icon: AlertTriangle,
      description: 'Pacientes ausentes há +7 dias. Ação imediata necessária.'
    },
    { 
      title: '⚠️ Alto Risco', 
      patients: highPatients, 
      color: 'orange',
      icon: Bell,
      description: 'Engajamento baixo. Contatar em breve.'
    },
    { 
      title: '⚡ Em atenção', 
      patients: mediumPatients, 
      color: 'amber',
      icon: TrendingUp,
      description: 'Sem dieta ou progresso moderado.'
    },
    { 
      title: '✅ Estáveis', 
      patients: lowPatients, 
      color: 'emerald',
      icon: Users,
      description: 'Acompanhamento normal. Manter rotina.'
    }
  ];
  
  const visibleSections = sections.filter(s => s.patients.length > 0);
  
  if (patients.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center p-10 md:p-14 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-center">
        <Users size={40} className="text-stone-300 dark:text-stone-600 mb-3" />
        <h3 className="text-base md:text-lg font-bold text-stone-800 dark:text-stone-200 mb-1">
          Nenhum paciente encontrado
        </h3>
        <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400">
          Ajuste os filtros ou aguarde novos cadastros.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-4 flex items-center gap-1.5 text-xs font-medium text-nutri-600 hover:text-nutri-700 transition-colors"
          >
            <FilterX size={12} /> Limpar filtros
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {visibleSections.map((section) => (
        <div key={section.title}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-1 h-5 rounded-full', (
                section.color === 'rose' ? 'bg-rose-400' :
                section.color === 'orange' ? 'bg-orange-400' :
                section.color === 'amber' ? 'bg-amber-400' :
                'bg-emerald-400'
              ))} />
              <h2 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                {section.title}
              </h2>
              <span className="text-xs font-medium text-stone-400">
                ({section.patients.length})
              </span>
            </div>
            <p className="text-[10px] text-stone-400 hidden md:block">
              {section.description}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            <AnimatePresence mode="popLayout">
              {section.patients.map(p => {
                const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);
                const usage = usageStats[p.id] || 0;
                const isEditing = editingId === p.id;
                
                return (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    usage={usage}
                    isDietReady={isDietReady}
                    isEditing={isEditing}
                    editFormData={editFormData}
                    onOpenDietBuilder={onOpenDietBuilder}
                    onOpenEvalModal={onOpenEvalModal}
                    onOpenClinicalModal={onOpenClinicalModal}
                    onEditProfile={onEditProfile}
                    onDeleteDiet={onDeleteDiet}
                    onGeneratePDF={onGeneratePDF}
                    onAutoReminder={onAutoReminder}
                    onEditFormChange={onEditFormChange}
                    onSaveProfile={onSaveProfile}
                    onCancelEdit={onCancelEdit}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ))}
      
      {criticalPatients.length > 0 && (
        <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" />
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
              Ações recomendadas automáticas:
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400">
              {criticalPatients.length} paciente(s) crítico(s) aguardando cobrança
            </span>
          </div>
        </div>
      )}
    </div>
  );
}