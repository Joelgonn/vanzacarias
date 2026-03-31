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
    updateLeadAnswers(newAnswers);

    if (currentStep < questions.length) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
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

  // Validação do formulário inicial
  const isLeadFormValid = leadName.length >= 2 && leadPhone.length >= 8 && isDateValid(leadBirthDate) && leadGender !== '';

  return (
    <main className="min-h-screen bg-gradient-to-br from-nutri-50/50 to-stone-100 flex flex-col pt-8 md:pt-12 px-4 md:px-6 font-sans text-stone-800 pb-20 selection:bg-nutri-800 selection:text-white">
      
      {/* Header / Nav */}
      <nav className="w-full max-w-3xl mx-auto flex items-center justify-between mb-8 md:mb-12">
        <Link 
          href="/" 
          className="group flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-stone-200/50 shadow-sm hover:shadow-md hover:border-nutri-800/30 transition-all duration-300 active:scale-[0.98]"
        >
          <div className="bg-stone-100 p-1.5 rounded-full group-hover:bg-nutri-800 transition-colors duration-300">
            <ChevronLeft size={14} className="text-stone-600 group-hover:text-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-stone-600 group-hover:text-nutri-900 transition-colors">Voltar</span>
        </Link>
        
        <div className="text-[10px] font-bold text-nutri-900 tracking-widest uppercase hidden sm:block opacity-80">
          Vanusa Zacarias Nutrição
        </div>
      </nav>

      {/* Card Principal */}
      <div className="w-full max-w-3xl mx-auto bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/50 p-6 md:p-14 relative overflow-hidden transition-all duration-500">
        
        {/* Barra de Progresso */}
        {!showLeadForm && (
          <div className="absolute top-0 left-0 w-full h-1.5 bg-stone-100/80">
            <div 
              className="h-full bg-gradient-to-r from-nutri-700 to-nutri-900 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {/* PASSO 0: CAPTURA DO LEAD */}
        {showLeadForm ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 text-center max-w-lg mx-auto py-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-4 tracking-tight">
              Vamos descobrir o seu perfil?
            </h1>
            <p className="text-stone-500 text-sm md:text-base mb-10 leading-relaxed font-medium">
              Para personalizarmos sua experiência e enviarmos seu resultado, precisamos te conhecer melhor.
            </p>

            <form onSubmit={handleStartQuiz} className="space-y-5 text-left">
              
              {/* Nome */}
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors duration-300" size={20} />
                <input 
                  type="text" 
                  required 
                  placeholder="Seu nome ou apelido" 
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 border border-stone-200/80 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all duration-300 text-stone-700 font-medium placeholder:text-stone-400" 
                />
              </div>
              
              {/* WhatsApp */}
              <div className="relative group">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors duration-300" size={20} />
                <input 
                  type="tel" 
                  required 
                  placeholder="Seu WhatsApp (DDD + Número)" 
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 border border-stone-200/80 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all duration-300 text-stone-700 font-medium placeholder:text-stone-400" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Data de Nascimento (Máscara + Teclado Numérico) */}
                <div className="relative group">
                  <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors duration-300" size={20} />
                  <input 
                    type="text" 
                    inputMode="numeric"
                    required 
                    placeholder="DD/MM/AAAA"
                    value={leadBirthDate}
                    onChange={handleDateChange}
                    className="w-full pl-14 pr-5 py-4 border border-stone-200/80 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all duration-300 text-stone-700 font-medium placeholder:text-stone-400 tracking-wide" 
                  />
                  <span className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Nascimento</span>
                </div>

                {/* Sexo (Seletores Premium) */}
                <div className="relative flex bg-stone-50/50 border border-stone-200/80 rounded-2xl p-1.5">
                  <span className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 z-10">Sexo</span>
                  <button
                    type="button"
                    onClick={() => setLeadGender('Feminino')}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                      leadGender === 'Feminino' 
                        ? 'bg-white shadow-sm text-nutri-900 border border-stone-200/50' 
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100/50 border border-transparent'
                    }`}
                  >
                    Feminino
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadGender('Masculino')}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                      leadGender === 'Masculino' 
                        ? 'bg-white shadow-sm text-nutri-900 border border-stone-200/50' 
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100/50 border border-transparent'
                    }`}
                  >
                    Masculino
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loadingLead || !isLeadFormValid}
                className="w-full flex items-center justify-center gap-3 bg-nutri-900 text-white py-4 mt-8 rounded-2xl font-bold text-lg hover:bg-nutri-800 active:scale-[0.98] transition-all duration-300 shadow-[0_8px_20px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_25px_rgb(0,0,0,0.15)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_8px_20px_rgb(0,0,0,0.12)]"
              >
                {loadingLead ? <Loader2 size={24} className="animate-spin" /> : 'Começar Avaliação'} 
                {!loadingLead && <ArrowRight size={22} />}
              </button>
            </form>
            
            <p className="flex items-center justify-center gap-2 text-[11px] text-stone-400 mt-8 font-semibold uppercase tracking-widest">
              <UserCheck size={14} /> Leva apenas 2 minutos.
            </p>
          </div>

        ) : currentStep < questions.length ? (
          
          /* PASSO 1 a 10: PERGUNTAS DO QUIZ */
          <div key={currentStep} className="animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
              <span className="bg-nutri-50 text-nutri-800 px-3 py-1 rounded-full font-bold text-[10px] tracking-widest uppercase border border-nutri-800/10">
                Pergunta {currentStep + 1} de {questions.length}
              </span>
              <span className="text-stone-400 text-[10px] font-bold tracking-widest uppercase">
                {Math.round(progress)}% Concluído
              </span>
            </div>
            
            <h2 className="text-2xl md:text-4xl font-extrabold text-stone-900 mb-10 leading-tight tracking-tight">
              {questions[currentStep].title}
            </h2>

            <div className="space-y-4 mb-12">
              {questions[currentStep].options.map((option, index) => {
                const isSelected = answers[currentStep] === option;
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(option)}
                    className={`w-full text-left p-5 md:p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group active:scale-[0.98]
                      ${isSelected 
                        ? 'border-nutri-800 bg-nutri-50/50 text-nutri-900 shadow-md transform -translate-y-0.5' 
                        : 'border-stone-100 hover:border-nutri-800/30 hover:bg-stone-50/50 text-stone-600 hover:shadow-sm'
                      }
                    `}
                  >
                    <span className="font-semibold pr-4 text-base md:text-lg leading-relaxed">{option}</span>
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300
                      ${isSelected ? 'border-nutri-800 bg-nutri-800 scale-110' : 'border-stone-200 group-hover:border-nutri-800/50'}
                    `}>
                      <CheckCircle2 size={16} className={`transition-opacity duration-300 ${isSelected ? 'opacity-100 text-white' : 'opacity-0'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-stone-100/80">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 text-stone-500 font-bold uppercase tracking-widest text-[11px] px-5 py-3 rounded-xl transition-all duration-300
                  ${currentStep === 0 ? 'opacity-0 cursor-default' : 'hover:bg-stone-100 hover:text-stone-800 active:scale-95'}
                `}
              >
                <ArrowLeft size={16} />
                Anterior
              </button>
              
              <button 
                onClick={nextStep}
                disabled={!answers[currentStep]}
                className={`flex items-center gap-2 font-bold uppercase tracking-widest text-[11px] py-4 px-8 rounded-full transition-all duration-300
                  ${answers[currentStep] 
                    ? 'bg-nutri-900 text-white shadow-[0_8px_20px_rgb(0,0,0,0.12)] hover:bg-nutri-800 hover:shadow-[0_12px_25px_rgb(0,0,0,0.15)] active:scale-95' 
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
          <div className="text-center py-10 animate-in zoom-in-95 fade-in duration-700">
            <div className="w-24 h-24 bg-gradient-to-br from-nutri-100 to-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-nutri-100">
              <CheckCircle2 size={48} className="text-nutri-800" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-5 tracking-tight">
              Perfil Mapeado!
            </h2>
            <p className="text-stone-500 text-base md:text-lg font-medium mb-12 max-w-md mx-auto leading-relaxed">
              Excelente, <span className="text-nutri-900 font-bold">{leadName.split(' ')[0]}</span>! Já temos as informações necessárias para entender seu metabolismo e rotina. Crie sua conta para acessar seu painel e falar com a Vanusa.
            </p>
            
            <Link 
              href="/cadastro" 
              onClick={() => localStorage.setItem('quiz_answers', JSON.stringify(answers))}
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-12 py-5 rounded-2xl font-bold text-lg hover:bg-nutri-800 active:scale-[0.98] transition-all duration-300 shadow-[0_8px_20px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_25px_rgb(0,0,0,0.15)] mb-8"
            >
              Criar minha conta gratuita <ArrowRight size={22} />
            </Link>
            
            <p className="text-sm text-stone-500 font-medium">
              Já é paciente? <Link href="/login" className="text-nutri-800 hover:text-nutri-900 hover:underline font-bold transition-colors">Faça login no portal</Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}