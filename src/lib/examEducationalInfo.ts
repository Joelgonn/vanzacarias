export type ExamEducationalInfo = {
  title: string
  whatItMeasures: string
  practicalMeaning: string
}

export const EXAM_EDUCATIONAL_INFO: Record<string, ExamEducationalInfo> = {
  glucose: {
    title: 'Glicose',
    whatItMeasures: 'Mede a quantidade de glicose circulando no sangue.',
    practicalMeaning: 'Ajuda a compreender como está a glicose no momento da coleta.',
  },
  insulin: {
    title: 'Insulina',
    whatItMeasures: 'Mede a quantidade de insulina circulando no sangue.',
    practicalMeaning: 'Ajuda a compreender a resposta do organismo relacionada à glicose no momento da coleta.',
  },
  hba1c: {
    title: 'HbA1c',
    whatItMeasures: 'Estima a média da glicose sanguínea dos últimos meses.',
    practicalMeaning: 'Mostra a exposição média à glicose ao longo do tempo, e não apenas o valor do dia.',
  },
  homair: {
    title: 'HOMA-IR',
    whatItMeasures: 'Estima a relação entre glicose e insulina em jejum.',
    practicalMeaning: 'Ajuda a compreender marcadores relacionados à sensibilidade à insulina no momento da coleta.',
  },
  total_cholesterol: {
    title: 'Colesterol total',
    whatItMeasures: 'Representa a quantidade total de colesterol transportado no sangue.',
    practicalMeaning: 'Deve ser compreendido junto às diferentes frações do colesterol.',
  },
  hdl: {
    title: 'HDL',
    whatItMeasures: 'Partícula que participa do transporte do colesterol dos tecidos de volta ao fígado.',
    practicalMeaning: 'É conhecido como “colesterol bom”, embora sua interpretação dependa do contexto do perfil lipídico.',
  },
  ldl: {
    title: 'LDL',
    whatItMeasures: 'Partícula que transporta colesterol para os tecidos.',
    practicalMeaning: 'É conhecido como “colesterol ruim” e faz parte da avaliação do perfil lipídico.',
  },
  triglycerides: {
    title: 'Triglicerídeos',
    whatItMeasures: 'Tipo de gordura presente no sangue e forma de armazenamento de energia.',
    practicalMeaning: 'Ajuda a compreender o metabolismo das gorduras circulantes.',
  },
  ferritin: {
    title: 'Ferritina',
    whatItMeasures: 'Proteína relacionada ao armazenamento de ferro.',
    practicalMeaning: 'Ajuda a compreender as reservas de ferro do organismo.',
  },
  pcr: {
    title: 'PCR',
    whatItMeasures: 'Proteína relacionada à resposta inflamatória do organismo.',
    practicalMeaning: 'Ajuda a compreender marcadores inflamatórios no momento da coleta.',
  },
  tgp: {
    title: 'TGP',
    whatItMeasures: 'Enzima encontrada principalmente nas células do fígado.',
    practicalMeaning: 'O exame mede a quantidade dessa enzima circulando no sangue.',
  },
  creatinine: {
    title: 'Creatinina',
    whatItMeasures: 'Substância produzida pelo metabolismo muscular e eliminada principalmente pelos rins.',
    practicalMeaning: 'O resultado é utilizado na avaliação relacionada à função renal.',
  },
  urea: {
    title: 'Ureia',
    whatItMeasures: 'Produto formado durante o metabolismo das proteínas e eliminado principalmente pelos rins.',
    practicalMeaning: 'Pode ajudar a compreender o metabolismo nitrogenado e a avaliação renal.',
  },
  vitamin_d: {
    title: 'Vitamina D — 25(OH)',
    whatItMeasures: 'Principal marcador sanguíneo utilizado para avaliar os níveis de vitamina D.',
    practicalMeaning: 'Representa a concentração de vitamina D medida no sangue.',
  },
  vitamin_b12: {
    title: 'Vitamina B12',
    whatItMeasures: 'Vitamina envolvida na formação das células sanguíneas e no funcionamento do sistema nervoso.',
    practicalMeaning: 'O resultado representa a quantidade de vitamina B12 medida na amostra.',
  },
  tsh: {
    title: 'TSH',
    whatItMeasures: 'Hormônio que estimula a tireoide a produzir seus hormônios.',
    practicalMeaning: 'Ajuda a compreender o eixo de regulação da tireoide.',
  },
  iron: {
    title: 'Ferro sérico',
    whatItMeasures: 'Quantidade de ferro presente no sangue no momento da coleta.',
    practicalMeaning: 'Representa o ferro circulante, não necessariamente todo o estoque de ferro do organismo.',
  },
}

export const STATUS_EDUCATIONAL: Record<string, { label: string; text: string }> = {
  normal: {
    label: 'Normal',
    text: 'Resultado dentro do intervalo de referência configurado para este indicador.',
  },
  warning: {
    label: 'Atenção',
    text: 'Resultado fora do intervalo considerado ideal pelo sistema. A classificação é informativa e deve ser interpretada junto aos valores de referência do laboratório.',
  },
  danger: {
    label: 'Risco',
    text: 'Resultado acima ou abaixo do limite configurado para este indicador. A classificação descreve o critério utilizado pelo sistema e não representa diagnóstico isolado.',
  },
}

export function getExamInfo(key: string): ExamEducationalInfo | undefined {
  return EXAM_EDUCATIONAL_INFO[key]
}
