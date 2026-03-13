'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle2, ChevronLeft, User, Phone, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Answer = string | null;

export default function Avaliacao() {
  // Estados do Lead
  const [showLeadForm, setShowLeadForm] = useState(true);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [loadingLead, setLoadingLead] = useState(false);

  // Estados do Questionário
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  
  const supabase = createClient();

  // Questionário de 10 Perguntas
  const questions = [
    {
      title: 'Qual é o seu objetivo principal ao buscar acompanhamento?',
      options: [
        'Emagrecimento focado em perda de gordura',
        'Ganho de massa muscular (Hipertrofia)',
        'Melhorar exames e saúde (Diabetes, Colesterol, etc)',
        'Mais energia, disposição e qualidade de vida'
      ]
    },
    {
      title: 'Você possui alguma condição de saúde ou usa medicação contínua?',
      options: [
        'Não, sou saudável e não tomo remédios',
        'Sim, para controle metabólico (Tireoide, Diabetes, Pressão)',
        'Sim, medicações para ansiedade, depressão ou sono',
        'Tenho diagnóstico ou suspeita de intolerâncias alimentares'
      ]
    },
    {
      title: 'Como você avalia o funcionamento do seu intestino?',
      options: [
        'Funciona perfeitamente todos os dias',
        'É um pouco preso, vou dia sim, dia não',
        'Sofro muito com intestino preso (passo dias sem ir)',
        'Tenho muito estufamento, gases ou diarreia frequente'
      ]
    },
    {
      title: 'Como costuma ser o seu nível de energia ao longo do dia?',
      options: [
        'Tenho energia o dia todo, acordo bem',
        'Acordo cansado, parece que não dormi',
        'Sinto muito sono e cansaço no meio da tarde',
        'Minha energia oscila muito dependendo do dia'
      ]
    },
    {
      title: 'Como você avalia a qualidade do seu sono atualmente?',
      options: [
        'Durmo a noite toda e acordo restaurado(a)',
        'Demoro muito para conseguir pegar no sono',
        'Acordo várias vezes durante a madrugada',
        'Durmo poucas horas por conta da minha rotina'
      ]
    },
    {
      title: 'Seja sincero(a): como é o seu consumo de água?',
      options: [
        'Bebo mais de 2.5 litros por dia facilmente',
        'Bebo entre 1 e 2 litros',
        'Bebo muito pouca água (menos de 1 litro)',
        'Bebo mais sucos/refrigerantes do que água pura'
      ]
    },
    {
      title: 'Como é a sua rotina de atividade física hoje?',
      options: [
        'Sou sedentário(a), não prático exercícios',
        'Pratico 1 ou 2 vezes na semana (caminhada, etc)',
        'Treino regularmente (3 a 5 vezes na semana)',
        'Sou atleta / Treino todos os dias intensamente'
      ]
    },
    {
      title: 'Você costuma usar a comida como "válvula de escape" emocional?',
      options: [
        'Sim, sempre como quando estou estressado(a) ou ansioso(a)',
        'Às vezes, principalmente vontade de doces à noite',
        'Raramente, tenho bom controle emocional com a comida',
        'Acontece mais na TPM ou em dias muito difíceis'
      ]
    },
    {
      title: 'Como você descreve sua rotina e tempo para cozinhar?',
      options: [
        'Tenho tempo e gosto de preparar minhas refeições',
        'Corrida, mas consigo me organizar se tiver um plano',
        'Muito corrida, acabo comendo muito na rua ou delivery',
        'Trabalho em turnos/horários irregulares'
      ]
    },
    {
      title: 'Qual tem sido o seu maior obstáculo com dietas no passado?',
      options: [
        'Dietas muito restritivas, acabo desistindo',
        'Sinto muita fome ou falta do que gosto de comer',
        'Falta de organização para comprar e preparar',
        'Nunca fiz dieta / É minha primeira vez'
      ]
    }
  ];

  // ==========================================
  // LÓGICA DE NEGÓCIOS (SUPABASE)
  // ==========================================

  // 1. Inicia o Quiz e salva o Lead no banco (UPSERT pelo WhatsApp)
  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLead(true);

    try {
      const { error } = await supabase
        .from('leads_avaliacao')
        .upsert(
          { 
            nome: leadName, 
            whatsapp: leadPhone, 
            status: 'incompleto',
            // updated_at é atualizado automaticamente pelo trigger que criamos no SQL
          },
          { onConflict: 'whatsapp' }
        );

      if (error) throw error;

      // Guarda o WhatsApp no localStorage para amarrar o cadastro depois
      localStorage.setItem('lead_whatsapp', leadPhone);
      setShowLeadForm(false);
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      alert("Ocorreu um erro ao iniciar. Tente novamente.");
    } finally {
      setLoadingLead(false);
    }
  };

  // 2. Atualiza o banco em background a cada resposta dada
  const updateLeadAnswers = async (newAnswers: Record<number, Answer>) => {
    // Não precisa dar await aqui para não travar a tela do usuário
    supabase
      .from('leads_avaliacao')
      .update({ respostas: newAnswers })
      .eq('whatsapp', leadPhone)
      .then(({ error }) => {
        if (error) console.error("Erro ao atualizar respostas:", error);
      });
  };

  // 3. Marca o Lead como concluído ao chegar na última tela
  const markLeadAsCompleted = async () => {
    await supabase
      .from('leads_avaliacao')
      .update({ status: 'concluido' })
      .eq('whatsapp', leadPhone);
  };

  // ==========================================
  // CONTROLES DE INTERFACE
  // ==========================================

  const handleSelect = (option: string) => {
    const newAnswers = { ...answers, [currentStep]: option };
    setAnswers(newAnswers);
    updateLeadAnswers(newAnswers); // Salva no banco silenciosamente

    if (currentStep < questions.length) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        // Se foi a última pergunta, atualiza o status para concluído
        if (currentStep === questions.length - 1) {
          markLeadAsCompleted();
        }
      }, 400);
    }
  };

  const nextStep = () => {
    if (currentStep < questions.length) {
      setCurrentStep(prev => prev + 1);
      if (currentStep === questions.length - 1) {
        markLeadAsCompleted();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const progress = ((currentStep) / questions.length) * 100;

  return (
    <main className="min-h-screen bg-nutri-50 flex flex-col pt-10 px-4 md:px-6 font-sans text-stone-800 pb-20">
      
      <nav className="w-full max-w-2xl mx-auto flex items-center justify-between mb-8 md:mb-12">
        <Link 
          href="/" 
          className="group flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all active:scale-[0.98]"
        >
          <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
            <ChevronLeft size={16} className="text-nutri-800 group-hover:text-white" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-600 group-hover:text-nutri-900">Voltar</span>
        </Link>
        
        <div className="text-xs font-bold text-nutri-900 tracking-widest uppercase hidden sm:block">
          Vanusa Zacarias Nutrição
        </div>
      </nav>

      <div className="w-full max-w-2xl mx-auto bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100 p-6 md:p-12 relative overflow-hidden">
        
        {/* Barra de Progresso (Só aparece se o form de lead já passou) */}
        {!showLeadForm && (
          <div className="absolute top-0 left-0 w-full h-1.5 bg-stone-100">
            <div 
              className="h-full bg-nutri-800 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {/* PASSO 0: CAPTURA DO LEAD */}
        {showLeadForm ? (
          <div className="animate-fade-in-up text-center max-w-md mx-auto py-4">
            <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-4 tracking-tight">
              Vamos descobrir o seu perfil?
            </h1>
            <p className="text-stone-500 text-sm md:text-base mb-8 leading-relaxed">
              Para personalizarmos sua experiência e enviarmos seu resultado, precisamos te conhecer melhor.
            </p>

            <form onSubmit={handleStartQuiz} className="space-y-4 text-left">
              <div className="relative group">
                <User className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
                <input 
                  type="text" 
                  required 
                  placeholder="Seu nome ou apelido" 
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 font-medium" 
                />
              </div>
              
              <div className="relative group">
                <Phone className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
                <input 
                  type="tel" 
                  required 
                  placeholder="Seu WhatsApp (DDD + Número)" 
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 font-medium" 
                />
              </div>

              <button 
                type="submit"
                disabled={loadingLead || leadPhone.length < 8}
                className="w-full flex items-center justify-center gap-2 bg-nutri-900 text-white py-4 mt-6 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingLead ? <Loader2 size={20} className="animate-spin" /> : 'Começar Avaliação'} 
                {!loadingLead && <ArrowRight size={20} />}
              </button>
            </form>
            <p className="text-[10px] text-stone-400 mt-6 font-medium uppercase tracking-widest">
              Leva apenas 2 minutos.
            </p>
          </div>

        ) : currentStep < questions.length ? (
          
          /* PASSO 1 a 10: PERGUNTAS DO QUIZ */
          <div key={currentStep} className="animate-fade-in-right">
            <div className="flex justify-between items-center mb-6">
              <span className="text-nutri-800 font-bold text-[10px] tracking-widest uppercase">
                Pergunta {currentStep + 1} de {questions.length}
              </span>
              <span className="text-stone-400 text-[10px] font-bold tracking-widest uppercase">
                {Math.round(progress)}% Concluído
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-8 leading-tight tracking-tight">
              {questions[currentStep].title}
            </h1>

            <div className="space-y-3 mb-10">
              {questions[currentStep].options.map((option, index) => {
                const isSelected = answers[currentStep] === option;
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(option)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between group active:scale-[0.98]
                      ${isSelected 
                        ? 'border-nutri-800 bg-nutri-50 text-nutri-900 shadow-sm' 
                        : 'border-stone-100 hover:border-nutri-800/30 hover:bg-stone-50 text-stone-600'
                      }
                    `}
                  >
                    <span className="font-semibold pr-4 text-sm md:text-base">{option}</span>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                      ${isSelected ? 'border-nutri-800 bg-nutri-800' : 'border-stone-300 group-hover:border-nutri-800/50'}
                    `}>
                      {isSelected && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-stone-100">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 text-stone-500 font-bold uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg transition-colors
                  ${currentStep === 0 ? 'opacity-0 cursor-default' : 'hover:bg-stone-100 hover:text-stone-800'}
                `}
              >
                <ArrowLeft size={16} />
                Anterior
              </button>
              
              <button 
                onClick={nextStep}
                disabled={!answers[currentStep]}
                className={`flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] py-3 px-8 rounded-full transition-all duration-300
                  ${answers[currentStep] 
                    ? 'bg-nutri-900 text-white shadow-lg hover:bg-nutri-800 transform hover:-translate-y-0.5' 
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'}
                `}
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          
          /* TELA FINAL: SUCESSO E CONVITE PARA CADASTRO */
          <div className="text-center py-8 animate-fade-in-up">
            <div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <CheckCircle2 size={40} className="text-nutri-800" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-4 tracking-tight">
              Perfil Mapeado!
            </h2>
            <p className="text-stone-500 text-sm md:text-base font-light mb-10 max-w-sm mx-auto leading-relaxed">
              Excelente, {leadName.split(' ')[0]}! Já temos as informações necessárias para entender seu metabolismo e rotina. Crie sua conta para acessar seu painel e falar com a Vanusa.
            </p>
            
            <Link 
              href="/cadastro" 
              onClick={() => localStorage.setItem('quiz_answers', JSON.stringify(answers))}
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg mb-6"
            >
              Criar minha conta gratuita <ArrowRight size={20} />
            </Link>
            
            <p className="text-sm text-stone-400">
              Já é paciente? <Link href="/login" className="text-nutri-800 hover:underline font-bold">Faça login no portal</Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}