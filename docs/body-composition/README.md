# Motor de Composição Corporal — DO-000.0

## Finalidade

Motor único, determinístico e testável para estimativa de composição corporal a partir de dobras cutâneas. Substitui cálculos duplicados/incorretos anteriores por uma única fonte de verdade para densidade corporal (DC), percentual de gordura (%G), massa gorda e massa magra.

Localização: `src/lib/nutrition/bodyComposition.ts` — função pública `calculateBodyComposition(input)`.

Consumidores na Fase 1:
- `src/lib/nutrition/bodyComposition.ts` (motor)
- `src/app/admin/useAdminDashboard.ts` (migrado — usa `buildBodyComposition` com `protocol:'jp7'` via motor)
- `src/lib/getPatientMetabolicData.ts` (migrado — chama `calculateBodyComposition` com `protocol:'jp7'` e `measurement_date` para idade)

Consumidores pendentes para Fase 2 (ainda com caminho antigo):
- `src/app/admin/paciente/[id]/historico/page.tsx` — duplicata inline `calculateBodyComposition` e `timelineData` que soma 9 dobras e usa idade atual
- `src/app/dashboard/page.tsx` — `SkinfoldRow` tipa só 7 campos e soma 7 com sítios errados (biceps/calf)
- `src/components/admin/historico/DobrasSection.tsx` — soma 7 local com sítios errados, casamento por `somatorio_dobras === sum.toFixed(1)`
- `src/lib/contextBuilder.ts` — label fixo `Jackson & Pollock - 7 Dobras`

## Escopo (Fase 1)

Implementa exclusivamente o motor matemático. NÃO inclui:

- UI / seletor de protocolo
- alteração de `ClinicalDataModal` (continua com 9 campos)
- alteração de banco / migration / persistência de `protocol`
- alteração visual de `historico`, `ProgressChart`, `Check-ins`, `Medidas`
- protocolo de 9 dobras (não existe, não será criado)

## Protocolos atualmente suportados

| Identificador | Nome | Status |
|---|---|---|
| `jp3` | Jackson & Pollock 3 dobras | Implementado |
| `jp7` | Jackson & Pollock 7 dobras | Implementado (sítios corrigidos) |
| `petroski4` | Petroski 4 dobras | Implementado |

Ver detalhes metodológicos em [PROTOCOLS.md](./PROTOCOLS.md).

## Fluxo geral

```
ClinicalDataModal (9 medidas → supabase:skinfolds)
  → consumers buscam skinfolds + peso/altura/nascimento/sexo
  → calculateBodyComposition({ protocol, sex, age, weight, height, skinfolds, conversion })
  → { protocol, label, sites, sum, density, bf, fatMass, leanMass, missing, warnings }
  → apresentação arredonda só na borda
```

Pipeline interno do motor (detalhe em [ARCHITECTURE.md](./ARCHITECTURE.md)):

```
entrada → validação sexo/idade → seleção sítios por sexo → validação dobras (null≠0)
→ soma exata → densidade → conversão Siri/Brozek → sanidade → massas → resultado
```

## Regras fundamentais

1. **09 medidas armazenadas ≠ protocolo de 09 dobras.** O banco mantém 9 dobras; cada protocolo escolhe explicitamente seus sítios e soma só eles. Nunca somar Σ9 automaticamente.
2. **Bicipital** permanece armazenável/exibível, mas não entra em JP3, JP7 ou Petroski 4.
3. **Panturrilha** entra somente no Petroski 4.
4. **Null nunca vira zero.** `null/undefined/''/0/≤0/NaN` é dobra ausente → `missing` → cálculo indisponível para aquele protocolo.
5. **Sexo desconhecido não recebe fallback.** `sex===null → bf null + warning`.
6. **Idade deve representar a data da medida.** `calculateAge(birthDate, referenceDate)` onde `referenceDate = measurement_date`. Idade atual só como fallback compatível até Fase 2.
7. **Arredondamento só na apresentação.** Motor retorna `density/bf/fatMass/leanMass/sum` com precisão completa; `fatMass = weight*(bf/100)` usa `bf` não-arredondado.
8. **Siri é padrão; Brozek é opção.** Conversão parametrizável.
9. **Sanidade não silencia.** `DC≤0` ou `bf ∉ (0,60)` retorna `density/bf null` com `warnings` legível.
10. **Peso/estatura:** JP3/JP7/Petroski-M calculam DC/BF sem peso; massas ficam `null` se peso ausente. Petroski-F exige peso (kg) e estatura (cm) já na fórmula de DC.

## Relação medidas armazenadas × protocolos

Banco `skinfolds`: `triceps, biceps, subscapular, axillary_media, pectoral, suprailiac, abdominal, thigh, calf` (9).

Mapeamento:

- JP3 usa 3 delas (por sexo)
- JP7 usa 7 delas (mesmos 7 para M/F)
- Petroski 4 usa 4 delas (por sexo, conjuntos distintos)
- Bicipital é a única das 9 que não é usada por nenhum dos três protocolos atuais (reservada para protocolos futuros e exibição)

Nenhum protocolo soma todas as 9.

## Protocolos futuros possíveis (não implementados)

Guedes, Faulkner e outros métodos validados poderão ser adicionados como novos `ProtocolId` mediante nova auditoria específica (publicação, sítios, sexo, idade, equação, unidades, requisitos, validação numérica, testes). Não documentar como implementados.

## Documentação relacionada

- [PROTOCOLS.md](./PROTOCOLS.md) — fórmulas, sítios, unidades, fontes
- [ARCHITECTURE.md](./ARCHITECTURE.md) — tipos, pipeline, helpers, consumidores
- [CHANGELOG.md](./CHANGELOG.md) — histórico DO-000.0 e pendências Fase 2
