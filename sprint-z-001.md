# Sprint Z-001

## Auditoria Cirurgica do Resumo Metabolico

Objetivo desta auditoria:
- Validar se a TMB esta sendo calculada corretamente.
- Conferir se o `GET atual real` esta coerente com os dados usados no painel.
- Confrontar a prescricao sugerida com o estado metabolico atual.
- Definir como personalizar metas e sugestoes sem perder consistencia entre telas.

## 1. Validacao Numerica

### 1.1 TMB

A TMB esta correta do ponto de vista matematico e clinico basico.

Hoje o sistema usa:
- `Katch-McArdle` quando existe `leanMass > 0`
- `Mifflin-St Jeor` quando nao ha massa magra util

No arquivo do historico, a formula esta em:
- [`src/app/admin/paciente/[id]/historico/page.tsx`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/app/admin/paciente/[id]/historico/page.tsx#L721)

No engine central, a mesma logica aparece em:
- [`src/lib/metabolicEngine.ts`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/lib/metabolicEngine.ts#L32)

Validacao com numeros:
- Homem, 75 kg, 178 cm, 25 anos, sem massa magra: `10*75 + 6.25*178 - 5*25 + 5 = 1742.5`, arredondado para `1743 kcal`.
- Mulher, 60 kg, 165 cm, 25 anos, sem massa magra: `10*60 + 6.25*165 - 5*25 - 161 = 1345.25`, arredondado para `1345 kcal`.
- Com `leanMass = 69 kg`: `370 + 21.6 * 69 = 1860.4`, arredondado para `1860 kcal`.

Conclusao:
- A TMB esta calculada corretamente.
- A escolha da formula esta coerente com a disponibilidade de massa magra.

### 1.2 GET

O `GET` atual nao esta errado matematicamente, mas ele nao e um GET "real" no sentido fisiologico estrito.

Hoje o sistema faz:
- `GET = TMB * 1.2 + avgActivityKcal`

Isso esta em:
- [`src/app/admin/paciente/[id]/historico/page.tsx`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/app/admin/paciente/[id]/historico/page.tsx#L752)
- [`src/lib/metabolicEngine.ts`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/lib/metabolicEngine.ts#L62)

Leitura tecnica:
- O `1.2` funciona como um fator basal de estilo sedentario/leve.
- O `avgActivityKcal` entra como componente extra de exercicio/atividade.
- Na pratica, isso gera um `GET estimado hibrido`, nao um valor medido.

Exemplo numerico:
- TMB 1743 kcal
- `1743 * 1.2 = 2091.6`
- Se `avgActivityKcal = 200`, o GET vira `2291.6`, arredondado para `2292 kcal`

Conclusao:
- O numero e util para prescricao.
- O nome `GET Atual Real` e conceitualmente forte demais para a formula atual.
- O rótulo mais honesto seria `GET estimado` ou `GET calculado`.

### 1.3 Media de atividade

Aqui existe uma diferenca importante entre telas.

No historico:
- `avgActivityKcal = soma dos ultimos 7 logs / 7`
- Mesmo que existam menos de 7 registros, o divisor continua sendo 7

Referencia:
- [`src/app/admin/paciente/[id]/historico/page.tsx`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/app/admin/paciente/[id]/historico/page.tsx#L714)

No engine central:
- `avgActivity = soma dos logs encontrados / quantidade real de logs`

Referencia:
- [`src/lib/getPatientMetabolicData.ts`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/lib/getPatientMetabolicData.ts#L143)

Impacto numerico:
- Se houver 3 dias com `100 kcal`, `120 kcal` e `80 kcal`, a media real e `100 kcal/dia`.
- No historico, a mesma soma vira `300 / 7 = 43 kcal/dia`.
- Isso gera subestimativa de `57 kcal/dia`.

Conclusao:
- Este e um ponto de inconsistência real.
- O historico e o admin podem mostrar bases metabolicas diferentes para o mesmo paciente.

### 1.4 Tendencia de peso

Hoje a tendencia e fraca para personalizacao fina.

O historico usa apenas os ultimos 2 check-ins para classificar:
- `losing`
- `gaining`
- `stable`

Referencia:
- [`src/app/admin/paciente/[id]/historico/page.tsx`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/app/admin/paciente/[id]/historico/page.tsx#L756)

Ponto critico:
- A funcao de recomendacao em [`src/lib/nutrition.ts`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/lib/nutrition.ts#L107) ja aceita `weightVelocity`.
- O historico nao calcula nem envia `weightVelocity`.
- Portanto, o motor perde a chance de detectar platou, perda rapida demais ou ganho rapido demais com mais precisao.

## 2. Confronto Entre Base Metabolica e Prescricao

### 2.1 Como a prescricao esta sendo gerada

O motor de recomendacao:
- escolhe o objetivo por BF, IMC ou fallback por peso
- ajusta calorias com deficit ou superavit percentual
- aplica correcoes de platou
- aplica piso metabolico
- ajusta macros por peso, BF e atividade

Referencia principal:
- [`src/lib/nutrition.ts`](C:/Users/joelg/Documents/Vanusa/vanzacariasnutri/src/lib/nutrition.ts#L125)

### 2.2 O que esta bom

- O uso de BF para decidir entre perda, ganho ou manutencao e melhor do que usar somente peso.
- A existencia de piso metabolico evita prescricao agressiva demais.
- O motor ja possui:
  - ajuste de platou
  - alerta por atividade baixa
  - alerta por atividade alta
  - ajuste de macros por objetivo

### 2.3 O que ainda esta generico

- O objetivo ainda depende de faixas relativamente amplas de BF.
- A recomendacao nao usa `weightVelocity`, mesmo o motor suportando esse dado.
- A atividade entra como media de kcal, mas nao esta sendo usada como fator de prescricao em uma logica realmente individualizada.
- O historico e o admin podem divergir por causa da media de atividade.

### 2.4 Leitura clinica

Hoje a prescricao esta correta como baseline, mas ainda nao esta no nivel de personalizacao que o produto promete visualmente.

Ela responde bem a:
- excesso de gordura
- baixo BF
- manutencao
- platou simples

Ela responde mal a:
- paciente com queda de peso acelerada
- paciente em platou longo
- paciente com atividade muito diferente da media
- paciente com massa magra alta, BF limiar e risco de perder performance

## 3. Proposta de Refatoracao

### 3.1 Objetivo da refatoracao

Unificar a logica metabolica em uma unica fonte de verdade, para que:
- admin
- historico
- modal de dieta
- resumo metabolico

usem os mesmos criterios de entrada, o mesmo calculo e a mesma nomenclatura.

### 3.2 Estrutura recomendada

Criar um motor compartilhado unico, por exemplo:
- `src/lib/metabolicModel.ts`

Ou consolidar definitivamente em um unico motor existente:
- `src/lib/metabolicEngine.ts`

Esse motor deve devolver um snapshot unico com:
- `weight`
- `height`
- `age`
- `bf`
- `leanMass`
- `avgActivity`
- `weightTrend`
- `weightVelocity`
- `tmb`
- `tmbMethod`
- `get`
- `recommendation`
- `sourceMetadata`

### 3.3 O que deve ser centralizado

Centralizar:
- escolha do peso mais recente
- escolha da altura mais recente
- calculo de BF
- calculo de massa magra
- media de atividade
- tendencia de peso
- velocity de peso
- calculo de TMB
- calculo de GET
- geracao da recomendacao

### 3.4 O que deve sair das telas

Remover das telas:
- formula de TMB duplicada
- formula de GET duplicada
- regra de tendencia duplicada
- regra de media de atividade duplicada
- qualquer label que sugira "real" quando o valor e estimado

### 3.5 Regra de migracao

As telas devem apenas:
- montar o contexto do paciente
- chamar o motor
- renderizar o resultado

Nao devem:
- recalcular a logica metabolica
- reinterpretar o GET
- redefinir peso/altura/atividade com regras diferentes

## 4. Revisao da Prescricao

### 4.1 Como eu ajustaria a prescricao

Eu manteria o motor atual como base, mas adicionaria uma camada de personalizacao em cima dele:

1. BF continua sendo o gatilho principal.
2. `weightVelocity` passa a ajustar o percentual de deficit/superavit.
3. `avgActivity` passa a afetar o tipo de macro sugerido.
4. A manutencao deixa de ser um estado "neutro" e passa a refletir contexto:
   - reposicao
   - consolidacao
   - reeducacao
   - recomposicao

### 4.2 Regras sugeridas

Perda de gordura:
- BF alto: manter deficit mais agressivo, mas com limites.
- BF limiar ou baixo: reduzir deficit.
- Se `weightVelocity` estiver muito negativa: subir calorias.
- Se houver platou real: correção pequena, nao grande.

Ganho de massa:
- BF baixo: superavit leve ou moderado.
- BF intermediario/alto: superavit mais conservador.
- Se o peso sobe rapido demais: reduzir calorias.

Manutencao:
- usar como fase clinica real, nao como fallback passivo
- indicar consolidacao e monitoramento

### 4.3 Metas mais personalizadas

As metas podem ficar mais inteligentes se passarem a usar:
- sexo
- BF
- massa magra
- tendencia de peso
- velocidade de peso
- nivel de atividade
- risco clinico alimentar
- objetivo atual da fase

Isso permite:
- meta de calorias por ciclo
- meta de proteina por contexto
- meta de carbo por atividade
- meta de gordura com piso mais inteligente

## 5. Do e Dont

### 5.1 Fazer

- Unificar o motor metabolico em um unico arquivo/função.
- Passar `weightVelocity` para a recomendacao.
- Calcular media de atividade com o numero real de logs disponiveis.
- Renomear `GET Atual Real` para `GET estimado`.
- Criar testes de regressao para TMB, GET, atividade e recomendacao.
- Exibir metadados de fonte: peso, altura e ultima data usada.

### 5.2 Nao fazer

- Nao manter calculo local em tela e calculo central ao mesmo tempo.
- Nao dividir atividade por 7 quando houver menos de 7 registros.
- Nao chamar de "real" um GET que e estimado.
- Nao usar apenas os ultimos 2 check-ins para personalizacao fina se o historico ja tem dados suficientes para calcular velocity.
- Nao duplicar motores em `nutrition.ts`, `recommendation.ts` e `metabolicEngine.ts` sem uma regra de dominancia clara.

## 6. Ordem Recomendada de Implementacao

1. Unificar a fonte de calculo metabolico.
2. Corrigir a media de atividade.
3. Calcular `weightVelocity`.
4. Atualizar a recomendacao para usar velocity.
5. Renomear o GET na UI.
6. Cobrir com testes.
7. Revisar as metas visiveis no admin e no historico.

## 7. Conclusao

A base atual esta funcional e matematicamente coerente na TMB, mas a camada metabolica ainda nao esta totalmente consistente entre telas nem totalmente personalizada.

Resumo objetivo:
- TMB: correta.
- GET: estimado, nao real.
- Media de atividade: inconsistente entre telas.
- Prescricao: boa base, porem ainda generica.
- Personalizacao: possivel e recomendada.

Minha recomendacao tecnica:
- consolidar a logica agora, antes de adicionar mais regras de negocio em cima de calculos duplicados.
- isso vai aumentar confianca clinica, consistencia visual e previsibilidade da prescricao.
