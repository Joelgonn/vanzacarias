# Arquitetura — DO-000.0

> Documenta a arquitetura efetivamente implementada em `src/lib/nutrition/bodyComposition.ts` na Fase 1. Nada fora de `docs/body-composition` foi alterado por esta tarefa de documentação.

## Arquivo do motor

`src/lib/nutrition/bodyComposition.ts` — único ponto de cálculo. Headers com referências:

```
Jackson 1978, Jackson et al. 1980, Petroski 1995, Siri 1961, Brozek 1963
```

## Tipos públicos

```ts
type ProtocolId = 'jp3' | 'jp7' | 'petroski4'
type Sex = 'M' | 'F'
type Conversion = 'siri' | 'brozek'

type Skinfolds = {
  triceps?, biceps?, subscapular?, axillary_media?,
  pectoral?, suprailiac?, abdominal?, thigh?, calf?: unknown
}

type BodyCompositionInput = {
  protocol: ProtocolId
  sex: Sex | null        // null → indisponível, sem fallback
  age: number | null     // idade na data da medida
  weight: number | null  // kg
  height: number | null  // cm (só Petroski F exige)
  skinfolds: Skinfolds | null | undefined
  conversion?: Conversion // default 'siri'
}

type BodyCompositionResult = {
  protocol, label, sites, sum, density, bf,
  fatMass, leanMass, missing, warnings
}
type IncompatibleResult = {
  protocol, label, sites, sum: null, density: null, bf: null,
  fatMass: null, leanMass: null, missing, warnings
}
```

## Constantes e registro declarativo

```ts
const PROTOCOLS: Record<ProtocolId, {
  label, sitesBySex: Record<Sex, SkinfoldKey[]>,
  requiresWeight: Record<Sex, boolean>,
  requiresHeight: Record<Sex, boolean>,
  density: Record<Sex, DensityFn>,
  ageRange: Record<Sex, [number, number]> // corrigido FIX: M[18,66] F[18,51] para petroski4
}>
export function getProtocolSites(protocol, sex): SkinfoldKey[]
```

Cada protocolo declara `label, sitesBySex, requiresWeight, requiresHeight, density (M/F), ageRange`. O motor não contém `if/else` espalhados por protocolo — toda decisão vem do registro.

`PROTOCOLS` atual (após FIX):

- `jp3`: M `[pectoral,abdominal,thigh]` F `[triceps,suprailiac,thigh]` `ageRange M[18,61] F[18,61]`
- `jp7`: M/F `[pectoral,axillary_media,triceps,subscapular,abdominal,suprailiac,thigh]` `ageRange M[18,61] F[18,61]`
- `petroski4`: M `[subscapular,triceps,suprailiac,calf]` `ageRange M[18,66]` / F `[axillary_media,suprailiac,thigh,calf]` `ageRange F[18,51]`, `requiresWeight/requiresHeight` só F=true; densidade F corrigida para `1.03465850 -0.00063129*Σ +0.00000187*Σ² -0.00031165*idade ...`

## Helpers

- `parseFoldValue(value): number|null` — `null/undefined/''/0/≤0/NaN → null`, `string` com `',' → '.'`, nunca `||0`. Usado para cada dobra obrigatória.
- `normalizeSex(gender): Sex|null` — mapeia `masculino/homem/m` → `M`, `feminino/mulher/f` → `F`, resto `null` sem fallback. Trata colisão `'mulher'.startsWith('m')`.
- `calculateAge(birthDate, referenceDate?)` — `referenceDate = measurement_date` quando fornecido; senão `new Date()`. Retorna `null` se inválido ou futuro.
- `normalizeHeightCm(height)` — `<3 → *100` (m→cm), senão `cm`. Só usado em Petroski F; caller deve preferir `cm`. Valida `100–250 cm` como warning.
- `toBodyFat(density, conversion)` — Siri/Brozek.
- `ageRange` — por sexo (`Record<Sex,[min,max]>`), verificado com `proto.ageRange[sex]`.

## Pipeline do motor

```
entrada: BodyCompositionInput
  → valida protocol existe, senão null
  → valida sex (null → IncompatibleResult + warning "Sexo não definido")
  → resolve sites = PROTOCOLS[protocol].sitesBySex[sex]
  → valida age (null → IncompatibleResult)
  → verifica ageRange → warnings se fora da faixa (não bloqueia)
  → para cada site: raw = skinfolds[site], parsed = parseFoldValue(raw)
       se null → missing.push(site)
  → se missing.length>0 → IncompatibleResult sum null + warnings "Dobras ausentes: ..."
  → sum = Σ valores
  → se requiresWeight[sex] e weight null/≤0 → IncompatibleResult sum mantido + warning Peso obrigatório
  → se requiresHeight[sex] e height null/≤0 → IncompatibleResult + warning Estatura obrigatória
  → heightCm = normalizeHeightCm(height) se necessário
  → density = PROTOCOLS[protocol].density[sex](sum, age, weight, heightCm)
  → se !isFinite ou ≤0 → IncompatibleResult + warning Densidade inválida
  → bf = toBodyFat(density, conversion)
  → se !isFinite ou ≤0 ou ≥60 → IncompatibleResult com density mantido + warning sanidade
  → se weight válido → fatMass=weight*(bf/100), leanMass=weight-fatMass
     senão fatMass/leanMass null + warning Peso não informado
  → retorna BodyCompositionResult com warnings acumulados
```

Nunca: `Σ9`. A soma é sempre a soma exata dos sítios do protocolo.

## Regras implementadas

- **Null nunca vira zero:** todo acesso a dobra passa por `parseFoldValue`; `skinfolds || 0` não existe.
- **Sexo desconhecido não recebe fallback:** `normalizeSex` retorna `null`; motor retorna indisponível.
- **Idade deve representar a data da medida:** `calculateAge(birthDate, referenceDate)`; consumidores migrados passam `measurement_date` (quando disponível). Até Fase 2, consumidores antigos ainda usam idade atual — documentado como pendência, sem adaptação silenciosa.
- **Arredondamento somente na apresentação:** motor retorna `density/bf/fatMass/leanMass/sum` com precisão completa; nenhum `toFixed` interno; massas derivadas de `bf` não-arredondado.
- **Petroski feminino exige peso e estatura:** validado antes de `density`; estatura em `cm`.
- **Siri é padrão; Brozek é opção:** `conversion` default `siri`.
- **Sanidade explícita:** `DC≤0` ou `bf` fora de `(0,60)` não viram `null` silencioso — retornam `IncompatibleResult` com `warnings`.

## Consumidores

### Migrados na Fase 1

- `src/app/admin/useAdminDashboard.ts` — `buildBodyComposition({ skin, weight, birthDate, gender, measurementDate, protocol:'jp7' })`. Agora passa `measurementDate` quando `latestSkin.measurement_date` existe.
- `src/lib/getPatientMetabolicData.ts` — removido cálculo inline com soma 7 errada (`biceps+calf`) e fallback sexo invertido; agora `calculateBodyComposition({ protocol:'jp7', sex: normalizeSex(gender), age: calculateAge(birth, measurement_date ?? today), ... })` + query `skinfolds` inclui `axillary_media, pectoral, calf, measurement_date`.

### Pendentes para Fase 2 (não migrados, documentados como tal)

- `src/app/admin/paciente/[id]/historico/page.tsx` — mantém duplicata inline `calculateBodyComposition(sum7, age, gender, weight)` e `timelineData` com `s1 = triceps+biceps+subscapular+axillary+pectoral+suprailiac+abdominal+thigh+calf` (Σ9) passado como `sum7`. Atualiza `useMemo` ainda com `patientAge` (idade hoje). Remoção só se indispensável — deixada para Fase 2.
- `src/app/dashboard/page.tsx` — `SkinfoldRow` omite `axillary_media/pectoral`; soma 7 com `biceps+calf` (sítios errados).
- `src/components/admin/historico/DobrasSection.tsx` — recalcula `sumOf7` local com sítios errados e casa por `somatorio_dobras === sum.toFixed(1)` (divergência 7 vs 9).
- `src/lib/contextBuilder.ts` — label fixo `Jackson & Pollock - 7 Dobras`, sem `protocol/sum`.

Nada do acima foi declarado como concluído.

## Compatibilidade

Para não quebrar Fase 2 incremental, o motor mantém wrappers `@deprecated`:

- `calculateSkinfoldSum(skin)` — agora soma os 7 corretos via `parseFoldValue`, mas marcado deprecated.
- `buildBodyComposition({ skin, weight, birthDate, gender, measurementDate?, protocol? })` — delega a `calculateBodyComposition` e retorna `null` se `sex`/`age` inválidos (sem fallback).

Novos códigos devem chamar `calculateBodyComposition` diretamente.

## Extensibilidade

Novos protocolos (Guedes, Faulkner, outros) exigem:

1. Nova auditoria (publicação, sítios por sexo, idade, equação, unidades, requisitos, validation datasets)
2. Nova entrada em `PROTOCOLS` com `sitesBySex, density, requiresWeight/Height, ageRange`
3. Testes de referência numericamente validados

Não implementar sem esses três passos.

## Modelo de seleção e persistência de protocolo — F3.1 (Fase 3)

**Decisão F3.0/F3.1:** protocolo pertence à **medição** (`skinfolds.protocol`), não exclusivamente ao paciente.

* **Schema:** `public.skinfolds.protocol TEXT NULL CHECK (protocol IN ('jp3','jp7','petroski4'))` — migration `20250913_add_protocol_to_skinfolds.sql`. `NULL` preserva histórico pré-F3.1 sem backfill.
* **Semântica:** cada linha `skinfolds` com `protocol='jp7'` é JP7 oficial naquela `measurement_date`; `2023 jp7, 2024 petroski4, nova 2026 jp3` coexistem sem reescrever passado.
* **Default para novas medições:** `jp7` no fluxo `ClinicalDataModal` (`protocol='jp7'` default) quando nenhum protocolo explícito; não aplicado retroativamente; `profiles.default_protocol` **não criado** nesta F3.1 (auditado inexistente, documentado como pendência Fase 3.2).
* **Coleta:** 9 dobras sempre coletáveis; protocolo só determina `missing`/`requiresWeight/Height`; coleta incompleta pode salvar `protocol=jp7` com `pectoral=NULL` → cálculo `INCOMPLETO`, não `0`.
* **Cálculo:** `skinfolds.protocol → ProtocolId → calculateBodyComposition() → sum/density/bf/fat/lean` — sem `body_compositions` nesta fase (não persistir BF), sem recalcular histórico.
* **Compatibilidade:** `SkinfoldsData.protocol?`, `SkinfoldRow.protocol?`, `ClinicalDataModal({protocol='jp7'})`; `motor` inalterado (`ProtocolId` reutilizado).
* **RLS:** `protocol` segue mesma policy de `skinfolds` (nenhuma nova policy, mesmo `user_id`).

## Seletor de protocolo e último protocolo como default — F3.2

* **Regra definitiva:** `initialProtocol = lastValidProtocol ?? 'jp7'` onde `lastValidProtocol` é último `skinfolds.protocol` válido (`jp3/jp7/petroski4`) do paciente ordenado por `measurement_date DESC, id DESC`; `NULL` histórico é ignorado (não apaga conhecimento).
* **Sem `profiles.default_protocol`:** default vem do histórico do paciente, não de coluna `profiles`.
* **Nova avaliação:** busca `skinfolds` com `user_id=patientId` + `protocol IN ('jp3','jp7','petroski4')` ordenado; sem histórico → `jp7`; falha de consulta → `jp7` com log.
* **Edição:** `initialProtocol` é o `protocol` da própria medição (inclui `null` preservado); não usa `lastValidProtocol` do paciente.
* **Seletor UI:** `ClinicalDataModal` com `<select id="protocol-select">` nativo (`JP3/JP7/Petroski4` via `PROTOCOLS[protocol].label`), `aria-label`, `touch 44px`, `loadingProtocol` desabilita, destaque de obrigatórios via `PROTOCOLS[selectedProtocol].sitesBySex[sex]` (borda `nutri-300`), 9 dobras sempre visíveis, troca não limpa campos.
* **Persistência:** `selectedProtocol` → `INSERT skinfolds {protocol}` (validado `CHECK`).
* **Responsivo:** `grid-cols-2 sm:grid-cols-3`, `select` full-width, sem overflow em 320/375/390/414/768/1024.
* **Histórico:** nenhum `UPDATE`/`backfill`/`recalculo`.

## Histórico usa protocolo da própria medição — F3.3

* **historico/page.tsx:** `timelineData` extrai `rawProtocol = skin.protocol`, valida `jp3/jp7/petroski4` else `null` → sem fallback JP7; `age = calculateAge(birth, measurement_date)`, `sex = normalizeSex(sexo)`, `height = currentHeight` (para Petroski F), `comp = calculateBodyComposition({protocol, sex, age, weight, height, skinfolds: skin})`; `somatorio_dobras = comp.sum`, `bf/fat/lean = comp.*`; inclui `protocol, density, skinfoldId` no ponto.
* **dashboard/page.tsx:** idem, `protocol` por medição, `somatorio_dobras` JP7/JP3/Petroski conforme, sem Σ9.
* **getPatientMetabolicData.ts / useAdminDashboard.ts:** usam `lastSkinfolds.protocol` se válido, senão não calculam (não fallback JP7).
* **DobrasSection.tsx:** `TimelinePoint` com `protocol, density, skinfoldId`; `sumForProtocol` via `PROTOCOLS[protocol].sitesBySex[sex]`; associação por `skinfoldId` (fallback `date`), sem `toFixed`; header mostra `JP3/JP7/Petroski4` ou `Protocolo não registrado`; `NULL` histórico exibe badge `S/ protocolo` e `sum null`.
* **contextBuilder.ts:** `UserData.composicaoCorporal.protocolo` + `protocoloLabel`; header dinâmico `JP3/JP7/Petroski4` ou `protocolo não registrado`, não mais fixo 7 Dobras.
* **Regra de precisão:** motor sem arredondamento; UI `toFixed(1)` só na borda; sem `toFixed` como chave.

## Body_compositions — resultado auditável, versionado e reprocessável — F3.4

* **Schema:** `public.body_compositions` (`id uuid PK`, `skinfold_id uuid FK skinfolds.id cascade`, `user_id uuid FK auth.users`, `measurement_date date`, `protocol TEXT CHECK jp3/jp7/petroski4`, `protocol_version TEXT '2026-09-11'`, `method TEXT CHECK siri/brozek`, `sum/density/bf/fat_mass/lean_mass double precision` sem arredondamento, `calculated_at timestamptz default now()`, `is_official boolean default true`, `created_by uuid`) — migration `20250914_create_body_compositions.sql`; índices `skinfold_id`, `user_id+measurement_date`, `protocol`, `is_official` parcial, único parcial `skinfold_id WHERE is_official` (um oficial por medição).
* **RLS:** espelha `skinfolds` (`auth.uid()=user_id OR profiles.role admin/nutricionista`), 4 policies `select/insert/update/delete`.
* **Fluxo:** `ClinicalDataModal` após `INSERT skinfolds` → `select id` → `persistBodyComposition({skinfoldId, userId, measurementDate, protocol, skinfolds: dobrasData, birthDate, sex, weight: antro weight, height: antro height})` via `src/lib/nutrition/bodyCompositionService.ts` (`PROTOCOL_VERSION='2026-09-11'`); `simulateBodyComposition()` efêmero para protocolos diferentes sem persistir.
* **Regras:** completo → oficial (`is_official=true` após desativar anterior `is_official=false`); incompleto (`missing`/peso/altura) → não persiste; `NULL` nunca vira zero; `skinfolds=COLETA`, `body_compositions=CALCULADO`, `bodyComposition.ts=FORMULA`; histórico antigo `NULL` sem backfill.
* **Versionamento:** `protocol_version` persistido; nova fórmula cria novo `body_compositions` sem apagar antigo.
* **Oficialidade:** um `is_official=true` por `skinfold_id`; reprocessamento cria novo oficial, antigo vira `false`.

## Consumo oficial persistido — F3.6 (encerramento Fase 2)

* **Regra:** `body_compositions WHERE skinfold_id=? AND is_official=true` é fonte quando existir; conjunto indivisível (`protocol, protocol_version, method, sum, density, bf, fat_mass, lean_mass, calculated_at`) transportado sem recalcular.
* **Fallback:** sem oficial + `protocol` válido → `calculateBodyComposition()` on-the-fly (temporário); `protocol NULL` → indisponível (sem fallback JP7).
* **Associação:** `skinfold_id` (preferencial), fallback `date`; sem `sum.toFixed()`.
* **N+1:** `historico` e `dashboard` carregam `body_compositions` em 1 query (`eq user_id, is_official`) e indexam por `skinfold_id` em memória.
* **Service:** `getOfficialBodyComposition(skinfoldId)` e `getOfficialBodyCompositionsMap(userId)` em `bodyCompositionService.ts`.

## Arquivos relacionados

- Testes: `src/lib/nutrition/__tests__/bodyComposition.test.ts` (54), `historicoPhase2.test.ts` (10), `f21Consistency.test.ts` (19), `f31ProtocolPersistence.test.ts` (12), `f32ProtocolSelector.test.ts` (17), `f33HistoricoProtocol.test.ts` (18), `f34BodyCompositions.test.ts` (31), `f36OfficialConsumption.test.ts` (17)
- Tipos: `src/types/patient.ts` (FoodRestriction, não afetado)
- Modelo metabólico: `src/lib/metabolicModel.ts` (SSOT de TMB/GET, não duplicado)
