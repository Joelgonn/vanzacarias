export type AnthropometryInfo = {
  title: string
  description: string
  image: string
  imageAlt: string
  caption?: string
  category: 'medida' | 'dobra'
}

export const measureInfo: Record<string, AnthropometryInfo> = {
  weight: {
    title: 'Peso',
    description: 'Mede a massa corporal total da pessoa avaliada.',
    image: '/images/anthropometry/medidas/peso.webp',
    imageAlt: 'Procedimento ilustrativo para aferição do peso',
    caption: 'Utilizado para acompanhar a evolução do peso corporal.',
    category: 'medida',
  },
  height: {
    title: 'Estatura',
    description: 'Mede a altura corporal total, da planta dos pés ao topo da cabeça.',
    image: '/images/anthropometry/medidas/estatura.webp',
    imageAlt: 'Procedimento ilustrativo para aferição da estatura',
    caption: 'Medida de referência para cálculo do IMC e acompanhamento.',
    category: 'medida',
  },
  waist: {
    title: 'Circunferência da cintura',
    description: 'Mede a circunferência da região da cintura na localização anatômica definida pelo protocolo.',
    image: '/images/anthropometry/medidas/circunferencia-cintura.webp',
    imageAlt: 'Local anatômico para medição da circunferência da cintura',
    caption: 'Imagem mostra o local correto da fita métrica na cintura.',
    category: 'medida',
  },
  hip: {
    title: 'Circunferência do quadril',
    description: 'Mede a circunferência na região de maior perímetro do quadril.',
    image: '/images/anthropometry/medidas/circunferencia-quadril.webp',
    imageAlt: 'Local anatômico para medição da circunferência do quadril',
    caption: 'Ponto de maior volume dos glúteos.',
    category: 'medida',
  },
  arm: {
    title: 'Circunferência do braço',
    description: 'Mede a circunferência do braço no ponto médio entre o acrômio e o olécrano.',
    image: '/images/anthropometry/medidas/circunferencia-braco.webp',
    imageAlt: 'Local anatômico para medição da circunferência do braço',
    caption: 'Braço relaxado ao lado do corpo.',
    category: 'medida',
  },
  forearm: {
    title: 'Circunferência do antebraço',
    description: 'Mede a circunferência na região de maior volume do antebraço.',
    image: '/images/anthropometry/medidas/circunferencia-antebraco.webp',
    imageAlt: 'Local anatômico para medição da circunferência do antebraço',
    caption: 'Imagem educativa do local de aferição.',
    category: 'medida',
  },
  thigh: {
    title: 'Circunferência da coxa',
    description: 'Mede a circunferência da coxa no ponto de maior perímetro.',
    image: '/images/anthropometry/medidas/circunferencia-coxa.webp',
    imageAlt: 'Local anatômico para medição da circunferência da coxa',
    caption: 'Coxa em posição anatômica de referência.',
    category: 'medida',
  },
  calf: {
    title: 'Circunferência da panturrilha',
    description: 'Mede a circunferência no ponto de maior volume da panturrilha.',
    image: '/images/anthropometry/medidas/circunferencia-panturrilha.webp',
    imageAlt: 'Local anatômico para medição da circunferência da panturrilha',
    caption: 'Panturrilha com apoio leve.',
    category: 'medida',
  },
  neck: {
    title: 'Circunferência do pescoço',
    description: 'Mede a circunferência na região média do pescoço.',
    image: '/images/anthropometry/medidas/circunferencia-pescoco.webp',
    imageAlt: 'Local anatômico para medição da circunferência do pescoço',
    caption: 'Fita posicionada horizontalmente.',
    category: 'medida',
  },
  chest: {
    title: 'Circunferência do tórax',
    description: 'Mede a circunferência torácica na altura do ponto mesoesternal.',
    image: '/images/anthropometry/medidas/circunferencia-torax.webp',
    imageAlt: 'Local anatômico para medição da circunferência do tórax',
    caption: 'Tórax em posição expiratória normal.',
    category: 'medida',
  },
}

export const foldInfo: Record<string, AnthropometryInfo> = {
  triceps: {
    title: 'Dobra tricipital',
    description: 'Avalia a espessura da dobra cutânea na região posterior do braço, sobre o músculo tríceps.',
    image: '/images/anthropometry/dobras/triceps.webp',
    imageAlt: 'Local anatômico da dobra cutânea tricipital',
    caption: 'Imagem mostra o local anatômico da dobra e a direção da coleta.',
    category: 'dobra',
  },
  biceps: {
    title: 'Dobra bicipital',
    description: 'Avalia a dobra na região anterior do braço, sobre o músculo bíceps.',
    image: '/images/anthropometry/dobras/biceps.webp',
    imageAlt: 'Local anatômico da dobra cutânea bicipital',
    caption: 'Face anterior do braço.',
    category: 'dobra',
  },
  subscapular: {
    title: 'Dobra subescapular',
    description: 'Avalia a dobra abaixo do ângulo inferior da escápula.',
    image: '/images/anthropometry/dobras/subescapular.webp',
    imageAlt: 'Local anatômico da dobra subescapular',
    caption: 'Diagonal a 45° a partir da escápula.',
    category: 'dobra',
  },
  axillary_media: {
    title: 'Dobra axilar média',
    description: 'Avalia a dobra na linha axilar média, ao nível do apêndice xifóide.',
    image: '/images/anthropometry/dobras/axilar-media.webp',
    imageAlt: 'Local anatômico da dobra axilar média',
    caption: 'Linha vertical sob a axila.',
    category: 'dobra',
  },
  pectoral: {
    title: 'Dobra peitoral',
    description: 'Avalia a dobra na região peitoral, entre a axila e o mamilo.',
    image: '/images/anthropometry/dobras/peitoral.webp',
    imageAlt: 'Local anatômico da dobra peitoral',
    caption: 'Diagonal entre axila e mamilo.',
    category: 'dobra',
  },
  suprailiac: {
    title: 'Dobra supra-ilíaca',
    description: 'Avalia a dobra logo acima da crista ilíaca, na linha axilar média.',
    image: '/images/anthropometry/dobras/suprailiaca.webp',
    imageAlt: 'Local anatômico da dobra supra-ilíaca',
    caption: 'Acima da crista ilíaca, oblíqua.',
    category: 'dobra',
  },
  abdominal: {
    title: 'Dobra abdominal',
    description: 'Avalia a dobra ao lado da cicatriz umbilical, vertical.',
    image: '/images/anthropometry/dobras/abdominal.webp',
    imageAlt: 'Local anatômico da dobra abdominal',
    caption: 'Aproximadamente 3 cm lateral à cicatriz umbilical.',
    category: 'dobra',
  },
  thigh: {
    title: 'Dobra da coxa',
    description: 'Avalia a dobra na face anterior da coxa, no ponto médio.',
    image: '/images/anthropometry/dobras/coxa.webp',
    imageAlt: 'Local anatômico da dobra da coxa',
    caption: 'Face anterior, vertical.',
    category: 'dobra',
  },
  calf: {
    title: 'Dobra da panturrilha',
    description: 'Avalia a dobra na face medial da panturrilha, no maior perímetro.',
    image: '/images/anthropometry/dobras/panturrilha-medial.webp',
    imageAlt: 'Local anatômico da dobra da panturrilha medial',
    caption: 'Face medial, vertical.',
    category: 'dobra',
  },
}

export const anthropometryEducationalInfo: Record<string, AnthropometryInfo> = {
  ...measureInfo,
  ...foldInfo,
} as const

export function getAnthropometryInfo(key: string, category: 'medida' | 'dobra'): AnthropometryInfo | undefined {
  return category === 'medida' ? measureInfo[key] : foldInfo[key]
}

// Aliases para chaves alternativas usadas nos tipos
// thigh/calf aparecem tanto em medidas quanto dobras — o catálogo acima já cobre,
// mas para medidas usamos thigh/calf como circunferência, para dobras os mesmos
// nomes com descrição diferente; a última definição prevalece (dobra). Para
// manter medidas com imagem correta, reexportamos aliases específicos:
export const anthropometryMeasureAliases: Record<string, string> = {
  thigh_measure: 'thigh',
  calf_measure: 'calf',
}
