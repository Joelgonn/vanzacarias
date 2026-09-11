# Protocolos — DO-000.0

> Reprodução fiel das fórmulas implementadas em `src/lib/nutrition/bodyComposition.ts`. Nenhum coeficiente foi inventado, alterado ou corrigido nesta documentação. Fontes conforme auditoria DO-000.

## Visão geral

| Protocolo | Identificador | Sítios (M) | Sítios (F) | Idade | Requisitos adicionais |
|---|---|---|---|---|---|
| Jackson & Pollock 3 dobras | `jp3` | 3 | 3 (outros) | obrigatória | peso só para massas |
| Jackson & Pollock 7 dobras | `jp7` | 7 | 7 (mesmos) | obrigatória | peso só para massas |
| Petroski 4 dobras | `petroski4` | 4 | 4 (outros) | obrigatória | M: peso só massas; F: peso+estatura obrigatórios para DC |

Unidades em todas as fórmulas: dobras `mm`, idade `anos`, peso `kg`, estatura `cm`, densidade `g/cm³`, %G `%`.

## Conversão DC → %G

Padrão: **Siri (1961)** ` %G = (4.95 / DC - 4.5) * 100 `

Opção: **Brozek et al. (1963)** ` %G = (4.57 / DC - 4.142) * 100 `

Seleção via `conversion: 'siri' | 'brozek'` (default `siri`).

## Massas

Se `weight` válido:

```
massa gorda (kg) = weight * (bf / 100)   // bf não-arredondado
massa magra (kg) = weight - massa gorda
```

Sem `weight` → `fatMass=null, leanMass=null` + warning (exceto Petroski-F, onde peso já é requisito de DC).

## FAIXAS ETÁRIAS (validação)

- JP3 / JP7: `18–61` anos (amostra Jackson 1978 / Jackson et al. 1980). Fora da faixa → `warnings` mas ainda calcula.
- Petroski 4: `18–66` (M) / `18–51` (F) na tese; implementação corrigida em DO-000.0-PETROSKI-FIX usa `M [18,66], F [18,51]` em `PROTOCOLS.ageRange`. Fora da faixa → warning.

## Comportamento quando faltam dados

- Dobra obrigatória ausente (`null/undefined/''/0/≤0/NaN`) → `missing` contém o sítio → `sum/density/bf null` + `warnings: Dobras ausentes: ...`
- `sex===null` → cálculo indisponível, `warnings: Sexo não definido` (sem fallback M/F)
- `age===null` → indisponível, `warnings: Idade não informada`
- `petroski4 F` sem `weight` ou `height` → indisponível com warning específico
- `DC≤0` ou `bf ∉ (0,60)` → `bf null` + `warnings: BF% fora do intervalo de sanidade` (não null silencioso)
- Peso ausente em JP → DC/BF ainda calculados, massas `null` + warning

---

## 1) Jackson & Pollock 3 dobras — `jp3`

Fontes: Jackson AS, Pollock ML. *Br J Nutr.* 1978;40:497-504 (homens) + Jackson AS, Pollock ML, Ward A. *Med Sci Sports Exerc.* 1980;12:175-182 (mulheres). Coeficientes reproduzidos em Margoti 2009.

### Sítios

- **Homens:** `pectoral + abdominal + thigh` (3)
- **Mulheres:** `triceps + suprailiac + thigh` (3)

Não misturar conjuntos.

### Fórmulas

Homens:

```
DC = 1.1093800 - 0.0008267*Σ3 + 0.0000016*Σ3² - 0.0002574*idade
Σ3 = pectoral + abdominal + thigh  (mm)
```

Mulheres:

```
DC = 1.0994921 - 0.0009929*Σ3 + 0.0000023*Σ3² - 0.0001392*idade
Σ3 = triceps + suprailiac + thigh  (mm)
```

### Requisitos

Dobras: 3 por sexo + idade. Peso só para massas. Estatura não usada.

---

## 2) Jackson & Pollock 7 dobras — `jp7`

Fontes: mesmas acima; coeficientes JP7 idem auditoria e MedEsportePapers JP7.

### Sítios — corrigidos no DO-000.0

**Homens e mulheres (mesmos 7):**

```
pectoral + axillary_media + triceps + subscapular + abdominal + suprailiac + thigh
```

**Importante:**

- `biceps` NÃO pertence ao JP7
- `calf` (panturrilha) NÃO pertence ao JP7

Código anterior (antes do DO-000.0) somava `triceps+biceps+subscapular+suprailiac+abdominal+thigh+calf` — combinação inexistente na literatura. Corrigido para os 7 acima.

### Fórmulas

Homens:

```
DC = 1.112 - 0.00043499*Σ7 + 0.00000055*Σ7² - 0.00028826*idade
```

Mulheres:

```
DC = 1.097 - 0.00046971*Σ7 + 0.00000056*Σ7² - 0.00012828*idade
Σ7 = pectoral+axillary_media+triceps+subscapular+abdominal+suprailiac+thigh (mm)
```

Coeficientes já estavam corretos antes; o defeito era a seleção/soma.

### Requisitos

7 dobras + idade. Peso só para massas.

---

## 3) Petroski 4 dobras — `petroski4`

Fonte: Petroski EL. *Desenvolvimento e validação de equações generalizadas para a estimativa da densidade corporal em adultos.* Tese UFSM 1995. Sítios e equações conforme MedEsportePapers/Petroski e excerto Dialnet 5847476.

### Sítios

- **Homens:** `subscapular + triceps + suprailiac + calf` (4)
- **Mulheres:** `axillary_media + suprailiac + thigh + calf` (4)

Panturrilha entra aqui (e só aqui dentre os três protocolos). Bicipital não entra.

### Fórmulas

Homens:

```
DC = 1.10726863 - 0.00081201*Σ4 + 0.00000212*Σ4² - 0.00041761*idade
Σ4 = subscapular + triceps + suprailiac + calf  (mm)
```

Mulheres (corrigida DO-000.0-PETROSKI-FIX — tese UFSM 1995 via R Auxiliar.R):

```
DC = 1.03465850 - 0.00063129*Σ4 + 0.00000187*Σ4² - 0.00031165*idade - 0.00048890*peso + 0.00051345*estatura
Σ4 = axillary_media + suprailiac + thigh + calf  (mm)
peso = kg, estatura = cm
```

Para Petroski feminino, **peso e estatura entram na própria fórmula de DC** (único protocolo com essa característica). Estatura deve estar em **cm** (ex.: `165`, não `1.65`). O motor normaliza `<3 → *100` como tolerância, mas o chamador deve preferir `cm`.

### Requisitos

- Homens: 4 dobras + idade (peso só para massas)
- Mulheres: 4 dobras + idade + peso + estatura (todas obrigatórias para DC)

---

## 4) Regra fundamental — 9 medidas armazenadas ≠ protocolo de 9 dobras

> Seção de destaque — ver também `README.md`.

- Banco `skinfolds` mantém 9 medidas: `triceps, biceps, subscapular, axillary_media, pectoral, suprailiac, abdominal, thigh, calf`
- Cada protocolo escolhe explicitamente seus sítios (tabelas acima).
- A soma é exclusivamente a soma dos sítios daquele protocolo.
- Nunca utilizar Σ9 automaticamente.
- `biceps` permanece disponível para armazenamento/exibição, mas não entra nos três protocolos atuais.
- `calf` entra somente no Petroski 4.
- Não existe protocolo de 9 dobras neste projeto.

---

## 5) Petroski feminino — correção confirmada (DO-000.0-PETROSKI-FIX)

Auditoria DO-000.0-PETROSKI identificou que a implementação inicial omitia o termo linear. A fórmula anterior ` -0.00063129*Σ4² -0.000311*idade` foi corrigida para ` -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade` conforme tese UFSM 1995 (via `GleidsonUERN/bodycomp R/Auxiliar.R Sex_options_Petroski4`). Com a correção, Σ4=40/50/60 (idade30/peso60/estatura165) produz DC 1.058/1.053/1.049 e BF 17.6/19.7/21.6% — plausíveis, sanidade preservada. Faixa F corrigida para 18–51. Ver `CHANGELOG.md` e `ARCHITECTURE.md`.

---

## Fontes

- Jackson AS, Pollock ML. Generalized equations for predicting body density of men. *Br J Nutr.* 1978;40:497-504.
- Jackson AS, Pollock ML, Ward A. Generalized equations for predicting body density of women. *Med Sci Sports Exerc.* 1980;12:175-182.
- Petroski EL. Desenvolvimento e validação de equações generalizadas para a estimativa da densidade corporal em adultos. Tese (Doutorado) – UFSM, Santa Maria, 1995.
- Siri WE. Body composition from fluid spaces and density. In: Brozek J, Henschel A (eds). *Techniques for Measuring Body Composition.* 1961.
- Brozek J, Grande F, Anderson JT, Keys A. Densitometric analysis of body composition. *Ann N Y Acad Sci.* 1963;110:113-140.
- Margoti T. Comparação entre equações de Jackson & Pollock 3 e 7 dobras. *Fit Perf J.* 2009;8(3):191-198 (reprodução dos coeficientes).
- Heyward VH, Wagner DR. *Applied Body Composition Assessment.* 2nd ed. Human Kinetics; 2004.

Não foram adicionadas novas referências além das já registradas na auditoria DO-000.
