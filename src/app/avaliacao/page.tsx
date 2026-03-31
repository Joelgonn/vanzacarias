'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle2, ChevronLeft, User, Phone, Loader2, Calendar, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Answer = string | null;

export default function Avaliacao() {
  // Estados do Lead
  const [showLeadForm, setShowLeadForm] = useState(true);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadBirthDate, setLeadBirthDate] = useState(''); // Agora armazena DD/MM/AAAA
  const [leadGender, setLeadGender] = useState('');
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
  // FUNÇÕES DE VALIDAÇÃO E MÁSCARA
  // ==========================================

  // Máscara para Data de Nascimento: DD/MM/AAAA
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não for número
    value = value.replace(/(\d{2})(\d)/, "$1/$2"); // Adiciona a primeira barra
    value = value.replace(/(\d{2})(\d)/, "$1/$2"); // Adiciona a segunda barra
    setLeadBirthDate(value.slice(0, 10)); // Limita a 10 caracteres
  };

  // Valida se a data digitada é real e faz sentido
  const isDateValid = (dateStr: string) => {
    if (dateStr.length !== 10) return false;
    const [day, month, year] = dateStr.split('/');
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900 || y > new Date().getFullYear()) return false;
    
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  };

  // ==========================================
  // LÓGICA DE NEGÓCIOS (SUPABASE)
  // ==========================================

  // 1. Inicia o Quiz e salva o Lead no banco
  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDateValid(leadBirthDate)) {
      alert("Por favor, insira uma data de nascimento válida.");
      return;
    }

    setLoadingLead(true);

    try {
      // Converte DD/MM/AAAA para YYYY-MM-DD para salvar corretamente no banco
      const [day, month, year] = leadBirthDate.split('/');
      const formattedDateForDB = `${year}-${month}-${day}`;

      const { error } = await supabase
        .from('leads_avaliacao')
        .upsert(
          { 
            nome: leadName, 
            whatsapp: leadPhone,
            data_nascimento: formattedDateForDB,
            sexo: leadGender,
            status: 'incompleto',
          },
          { onConflict: 'whatsapp' }
        );

      if (error) throw error;

      // Guarda TODOS os dados no localStorage para amarrar e usar no cadastro (tabela profiles) depois
      localStorage.setItem('lead_nome', leadName);
      localStorage.setItem('lead_whatsapp', leadPhone);
      localStorage.setItem('lead_data_nascimento', formattedDateForDB);
      localStorage.setItem('lead_sexo', leadGender);
      
      setShowLeadForm(false);
    } catch (error: any) {
      console.error("Erro detalhado ao salvar lead:", JSON.stringify(error, null, 2), error);
      alert(`Ocorreu um erro ao iniciar: ${error?.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      setLoadingLead(false);
    }
  };

  // 2. Atualiza o banco em background a cada resposta dada
  const updateLeadAnswers = async (newAnswers: Record<number, Answer>) => {
    supabase
      .from('leads_avaliacao')
      .update({ respostas: newAnswers })
      .eq('whatsapp', leadPhone)
      .then(({ error }) => {
        if (error) {
          console.error("Erro detalhado ao atualizar respostas:", JSON.stringify(error, null, 2));
        }
      });
  };

  // 3. Marca o Lead como concluído ao chegar na última tela
  const markLeadAsCompleted = async () => {
    const { error } = await supabase
      .from('leads_avaliacao')
      .update({ status: 'concluido' })
      .eq('whatsapp', leadPhone);
      
    if (error) {
      console.error("Erro detalhado ao marcar como concluído:", JSON.stringify(error, null, 2));
    }
  };

  // ==========================================
  // CONTROLES DE INTERFACE
  // ==========================================

  const handleSelect = (option: string) => {
    const newAnswers = { ...answers, [currentStep]: option };
    setAnswers(newAnswers);
    updateLeadAnswers(newAnswers);

    if (currentStep < questions.length) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        if (currentStep === questions.length - 1) {
          markLeadAsCompleted();
        }
      }, 400); // Suave delay para o usuário ver que clicou
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

  // Validação do formulário inicial
  const isLeadFormValid = leadName.length >= 2 && leadPhone.length >= 8 && isDateValid(leadBirthDate) && leadGender !== '';

  return (
    <main className="min-h-screen bg-[#F8F9FA] flex flex-col pt-6 md:pt-10 px-4 md:px-6 font-sans text-stone-800 pb-12 selection:bg-nutri-200">
      
      {/* Header / Nav */}
      <nav className="w-full max-w-2xl mx-auto flex items-center justify-between mb-6 md:mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
        <Link 
          href="/" 
          className="group flex items-center justify-center gap-2 h-10 md:h-11 px-4 md:px-5 bg-white border border-stone-200/80 rounded-full shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:border-nutri-300 hover:shadow-md active:scale-[0.98] transition-all duration-300 text-stone-600 hover:text-nutri-700 shrink-0"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest hidden sm:inline">Voltar</span>
        </Link>
        
        <div className="text-[10px] md:text-[11px] font-black text-stone-400 tracking-[0.15em] uppercase text-right">
          Vanusa Zacarias <span className="hidden sm:inline">Nutrição</span>
        </div>
      </nav>

      {/* Card Principal - Premium Onboarding Style */}
      <div className="w-full max-w-2xl mx-auto bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl md:shadow-2xl border border-stone-100/50 relative overflow-hidden transition-all duration-500 flex-1 sm:flex-none flex flex-col">
        
        {/* Barra de Progresso Superior */}
        {!showLeadForm && currentStep < questions.length && (
          <div className="absolute top-0 left-0 w-full h-1.5 bg-stone-100 z-10">
            <div 
              className="h-full bg-nutri-500 transition-all duration-700 ease-out rounded-r-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <div className="p-6 md:p-12 lg:p-14 flex-1 flex flex-col justify-center relative z-0">
          
          {/* ========================================== */}
          {/* PASSO 0: CAPTURA DO LEAD                   */}
          {/* ========================================== */}
          {showLeadForm ? (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 w-full max-w-md mx-auto py-2">
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-3 tracking-tight leading-tight">
                  Vamos descobrir o seu perfil?
                </h1>
                <p className="text-stone-500 text-sm md:text-base font-medium leading-relaxed">
                  Para personalizarmos sua experiência e enviarmos seu resultado, precisamos te conhecer melhor.
                </p>
              </div>

              <form onSubmit={handleStartQuiz} className="space-y-4 md:space-y-5">
                
                {/* Nome - Floating Label */}
                <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
                  <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                    Como podemos te chamar?
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                    <input 
                      type="text" 
                      required 
                      placeholder="Seu nome" 
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg placeholder:text-stone-300 placeholder:font-medium" 
                    />
                  </div>
                </div>
                
                {/* WhatsApp - Floating Label */}
                <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
                  <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                    WhatsApp
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                    <input 
                      type="tel" 
                      required 
                      placeholder="(00) 00000-0000" 
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg placeholder:text-stone-300 placeholder:font-medium" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  
                  {/* Nascimento - Floating Label */}
                  <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
                    <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                      Nascimento
                    </label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                      <input 
                        type="text" 
                        inputMode="numeric"
                        required 
                        placeholder="DD/MM/AAAA"
                        value={leadBirthDate}
                        onChange={handleDateChange}
                        className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg placeholder:text-stone-300 placeholder:font-medium" 
                      />
                    </div>
                  </div>

                  {/* Sexo (Seletores Segmentados) */}
                  <div className="relative flex flex-col bg-stone-50/50 hover:bg-stone-50 border border-stone-200 rounded-2xl transition-all p-1.5 shadow-sm">
                    <span className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 z-10 hidden md:block">Sexo</span>
                    <div className="flex w-full h-full gap-1">
                      <button
                        type="button"
                        onClick={() => setLeadGender('Feminino')}
                        className={`flex-1 flex items-center justify-center text-xs md:text-sm font-bold rounded-xl transition-all duration-300 ${
                          leadGender === 'Feminino' 
                            ? 'bg-white shadow-sm text-nutri-900 border border-stone-200/80' 
                            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100 border border-transparent'
                        }`}
                      >
                        Feminino
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadGender('Masculino')}
                        className={`flex-1 flex items-center justify-center text-xs md:text-sm font-bold rounded-xl transition-all duration-300 ${
                          leadGender === 'Masculino' 
                            ? 'bg-white shadow-sm text-nutri-900 border border-stone-200/80' 
                            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100 border border-transparent'
                        }`}
                      >
                        Masculino
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 md:pt-6">
                  <button 
                    type="submit"
                    disabled={loadingLead || !isLeadFormValid}
                    className="w-full h-14 md:h-16 flex items-center justify-center gap-3 bg-stone-900 text-white rounded-2xl font-bold text-lg hover:bg-stone-800 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-stone-900/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {loadingLead ? <Loader2 size={24} className="animate-spin" /> : 'Começar Avaliação'} 
                    {!loadingLead && <ArrowRight size={22} />}
                  </button>
                </div>
              </form>
              
              <p className="flex items-center justify-center gap-1.5 text-[10px] md:text-[11px] text-stone-400 mt-6 md:mt-8 font-bold uppercase tracking-widest">
                <UserCheck size={14} /> Leva menos de 2 minutos.
              </p>
            </div>

          ) : currentStep < questions.length ? (
            
          /* ========================================== */
          /* PASSO 1 a 10: PERGUNTAS DO QUIZ            */
          /* ========================================== */
            <div key={currentStep} className="animate-in slide-in-from-right-8 fade-in duration-500 w-full max-w-xl mx-auto flex flex-col h-full">
              
              <div className="flex flex-col mb-8 md:mb-10">
                <span className="text-nutri-600 font-extrabold text-[10px] md:text-xs tracking-widest uppercase mb-3">
                  Pergunta {currentStep + 1} de {questions.length}
                </span>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-stone-900 leading-tight tracking-tight">
                  {questions[currentStep].title}
                </h2>
              </div>

              <div className="space-y-3 md:space-y-4 mb-10 flex-1">
                {questions[currentStep].options.map((option, index) => {
                  const isSelected = answers[currentStep] === option;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelect(option)}
                      className={`w-full text-left p-4 md:p-5 lg:p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group active:scale-[0.98]
                        ${isSelected 
                          ? 'border-nutri-400 bg-nutri-50 text-nutri-900 shadow-md ring-4 ring-nutri-50 -translate-y-0.5' 
                          : 'border-stone-100 bg-white hover:border-stone-200 hover:bg-stone-50 text-stone-600 hover:shadow-sm'
                        }
                      `}
                    >
                      <span className={`font-bold pr-4 text-sm md:text-base leading-relaxed transition-colors ${isSelected ? 'text-nutri-900' : 'text-stone-700'}`}>
                        {option}
                      </span>
                      <div className={`flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300
                        ${isSelected ? 'border-nutri-500 bg-nutri-500 scale-110' : 'border-stone-300 group-hover:border-nutri-300'}
                      `}>
                        <CheckCircle2 size={16} strokeWidth={3} className={`transition-opacity duration-300 ${isSelected ? 'opacity-100 text-white' : 'opacity-0'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Botões de Navegação do Quiz */}
              <div className="flex justify-between items-center pt-6 border-t border-stone-100">
                <button 
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={`flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] md:text-[11px] h-12 px-5 md:px-6 rounded-xl transition-all duration-300
                    ${currentStep === 0 ? 'opacity-0 cursor-default' : 'text-stone-500 bg-stone-100 hover:bg-stone-200 hover:text-stone-800 active:scale-[0.98]'}
                  `}
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
                
                <button 
                  onClick={nextStep}
                  disabled={!answers[currentStep]}
                  className={`flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] md:text-[11px] h-12 px-6 md:px-8 rounded-xl transition-all duration-300
                    ${answers[currentStep] 
                      ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/10 hover:bg-stone-800 active:scale-[0.98]' 
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'}
                  `}
                >
                  Próximo
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            
          /* ========================================== */
          /* TELA FINAL: SUCESSO E CONVITE PARA CADASTRO*/
          /* ========================================== */
            <div className="text-center py-8 md:py-12 animate-in zoom-in-95 fade-in duration-700 max-w-lg mx-auto">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-inner border border-emerald-100 relative">
                <div className="absolute inset-0 bg-emerald-400 opacity-20 blur-xl rounded-full animate-pulse"></div>
                <CheckCircle2 size={40} className="text-emerald-500 relative z-10 md:w-12 md:h-12" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-4 tracking-tight">
                Perfil Mapeado!
              </h2>
              <p className="text-stone-500 text-sm md:text-base font-medium mb-10 md:mb-12 leading-relaxed">
                Excelente, <span className="text-stone-900 font-extrabold">{leadName.split(' ')[0]}</span>! Já temos as informações necessárias para entender seu metabolismo e rotina. Crie sua conta gratuita para acessar seu painel e falar com a nutri.
              </p>
              
              <div className="flex flex-col gap-4">
                <Link 
                  href="/cadastro" 
                  onClick={() => localStorage.setItem('quiz_answers', JSON.stringify(answers))}
                  className="w-full inline-flex items-center justify-center gap-3 bg-stone-900 text-white h-14 md:h-16 rounded-2xl font-bold text-base md:text-lg hover:bg-stone-800 active:scale-[0.98] transition-all duration-300 shadow-xl shadow-stone-900/15"
                >
                  Criar minha conta gratuita <ArrowRight size={20} />
                </Link>
                
                <Link 
                  href="/login" 
                  className="w-full inline-flex items-center justify-center h-14 rounded-2xl font-bold text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-all duration-300 border border-transparent hover:border-stone-200"
                >
                  Já é paciente? Faça login no portal
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}