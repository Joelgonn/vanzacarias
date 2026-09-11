# Changelog — Motor de Composição Corporal

## DO-000.0-PETROSKI-FIX — 2026-09-11

Correção autorizada da auditoria DO-000.0-PETROSKI (não inicia Fase 2):

- Petroski F: `1.03465850 -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade -0.00048890*peso +0.00051345*estatura` (era ` -0.00063129*Σ4² -0.000311*idade`).
- Faixa Petroski F corrigida `18–51` (`PROTOCOLS.ageRange Record<Sex>`).
- Testes Petroski F atualizados para Σ4=40/50/60 (idade30/peso60/est165).
- Docs `PROTOCOLS.md` / `ARCHITECTURE.md` atualizados; alerta de DC negativa removido.

## DO-000.0 — 2026-09-11

Base: auditoria DO-000 (identificação de sítios trocados JP7, divergência Σ9 vs Σ7, fallback de sexo, `null→0`, idade atual para medidas históricas).

### Criação do motor único

- Novo arquivo-motor `src/lib/nutrition/bodyComposition.ts` reescrito como única fonte de verdade.
- Tipos: `ProtocolId ('jp3'|'jp7'|'petroski4')`, `Sex ('M'|'F')`, `Conversion ('siri'|'brozek')`, `Skinfolds (9 campos)`, `BodyCompositionInput`, `BodyCompositionResult`, `IncompatibleResult`.
- Helpers: `parseFoldValue`, `normalizeSex`, `calculateAge(birthDate, referenceDate)`, `normalizeHeightCm`, `getProtocolSites`.
- Registro declarativo `PROTOCOLS` com `label, sitesBySex, requiresWeight, requiresHeight, density (M/F), ageRange` (`Record<Sex,[min,max]>` — petroski4 `M[18,66] F[18,51]` após FIX). Nenhum `if/else` por protocolo espalhado.

### Implementação JP3

- Sítios: M `pectoral+abdominal+thigh`, F `triceps+suprailiac+thigh`.
- Fórmulas: M `1.10938 -0.0008267*Σ3 +0.0000016*Σ3² -0.0002574*idade`, F `1.0994921 -0.0009929*Σ3 +0.0000023*Σ3² -0.0001392*idade`.

### Correção JP7

- Sítios corrigidos para M/F `pectoral+axillary_media+triceps+subscapular+abdominal+suprailiac+thigh` (remove `biceps, calf`).
- Fórmulas (já corretas, preservadas): M `1.112 -0.00043499*Σ7 +0.00000055*Σ7² -0.00028826*idade`, F `1.097 -0.00046971*Σ7 +0.00000056*Σ7² -0.00012828*idade`.
- Principal defeito corrigido era seleção/soma, não coeficientes.

### Implementação Petroski 4

- Sítios: M `subscapular+triceps+suprailiac+calf`, F `axillary_media+suprailiac+thigh+calf`.
- Fórmulas: M `1.10726863 -0.00081201*Σ4 +0.00000212*Σ4² -0.00041761*idade`, F `1.03465850 -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade -0.00048890*peso +0.00051345*estatura` (peso kg, estatura cm) — corrigida em DO-000.0-PETROSKI-FIX (era ` -0.00063129*Σ4² -0.000311*idade`).

### Validação de null

- `parseFoldValue` converte `null/undefined/''/0/≤0/NaN` → `null`; dobra ausente entra em `missing`.
- Se qualquer sítio obrigatório ausente → cálculo indisponível (`sum/density/bf null + warnings`), sem soma parcial, sem `||0`.

### Remoção de fallback silencioso de sexo

- `normalizeSex` retorna `Sex|null`; `sex===null → bf null + warning`, sem assumir M/F. Corrige divergência prévia entre `lib` (fallback F) e `getPatientMetabolicData` (fallback M).

### calculateAge com referenceDate

- Assinatura `calculateAge(birthDate, referenceDate?)` onde `referenceDate = measurement_date` quando disponível; senão `new Date()`. Idade agora pode representar a data da medida, não apenas hoje.

### Siri/Brozek

- `conversion` default `siri`: `(4.95/DC -4.5)*100`; opção `brozek`: `(4.57/DC -4.142)*100`.

### Cálculo sem arredondamento intermediário

- Motor retorna `density/bf/fatMass/leanMass/sum` com precisão completa; nenhum `toFixed` interno; `fatMass=weight*(bf/100)` usa `bf` não-arredondado; `leanMass=weight-fatMass`.

### Testes, typecheck, build

- 54 testes unitários em `src/lib/nutrition/__tests__/bodyComposition.test.ts` cobrindo JP3/JP7/Petroski M/F, soma correta, sítios por sexo, sexo null, idade, peso/altura (inclui Σ4=40/50/60 para Petroski F), Siri/Brozek, massas, null/zero/string/inválido, arredondamento, casos críticos JP7 (biceps/calf) e Petroski F (linear+quadrático).
- 620 testes do projeto passando (38 suites).
- `npx tsc --noEmit` 0 erros.
- `npx eslint` 0 erros (1 warning pré-existente `exhaustive-deps` em `useAdminDashboard`).
- `npm run build` OK (warnings preexistentes de service worker).

### Consumidores migrados

- `src/app/admin/useAdminDashboard.ts` — passa `measurementDate` e `protocol:'jp7'`.
- `src/lib/getPatientMetabolicData.ts` — remove cálculo inline com soma errada; delega ao motor com `normalizeSex` + `calculateAge(birth, measurement_date)`.

### Problemas que permanecem para Fase 2 (atualizado pós-F2.0/F3.1)

- Duplicata inline em `historico/page.tsx` **corrigida em F2.0** (removida).
- `timelineData` em `historico/page.tsx` e `dashboard/page.tsx` **corrigidos em F2.0** (JP7 via motor, idade na medida, matching por data).
- Soma 9 legada `somatorio_dobras` **ressemantizada para JP7** em F2.0 (não mais Σ9).
- Seleção de protocolo na UI (segmented JP3/JP7/Petroski) **não implementada** (Fase 3).
- Persistência `protocol` — **F3.1 criou `skinfolds.protocol` TEXT NULL CHECK** (migration 20250913); `body_compositions` continua não criada; `profiles.default_protocol` não criado (Fase 3.2).
- Padronização definitiva da estatura (m vs cm) pendente.
- Timezone `measurement_date` pendente.
- Wrappers deprecated mantidos.

### Petroski feminino — correção confirmada (DO-000.0-PETROSKI-FIX)

Auditoria DO-000.0-PETROSKI identificou omissão do termo linear na fórmula feminina (implementação inicial ` -0.00063129*Σ4² -0.000311*idade` → corrigida para ` -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade` per tese UFSM 1995 via R Auxiliar.R). Faixa F corrigida para 18–51. Com Σ4=40/50/60 (idade30/peso60/est165) DC 1.058/1.053/1.049 e BF 17.6/19.7/21.6% — plausível.

## DO-0001.0-F2.0 — 2026-09-11

Histórico JP7 corrigido: `historico/page.tsx` e `dashboard/page.tsx` migrados para motor `jp7` com 7 sites corretos, idade na `measurement_date`, `null≠0`, matching por `date` (sem `toFixed`). `DobrasSection` `sumOf7` corrigido. 10 testes F2.0 + 19 testes F2.1 → 649 testes.

## DO-0001.0-F3.1 — 2026-09-11

Persistência canônica por medição: `public.skinfolds.protocol TEXT NULL CHECK (jp3/jp7/petroski4)` — migration `20250913_add_protocol_to_skinfolds.sql`. `NULL` preserva histórico pré-F3.1, sem backfill. Novas medições `ClinicalDataModal` persistem `protocol` (default `jp7`, validado). Tipos `SkinfoldsData/SkinfoldRow.protocol?`, `ProtocolId` reutilizado. Sem `body_compositions`, sem BF persistido, sem recálculo histórico, RLS preservado. Testes F3.1 (12) → 661 testes.

## DO-0001.0-F3.2 — 2026-09-11

Seletor de protocolo: `ClinicalDataModal` com `<select>` JP3/JP7/Petroski4 (labels `PROTOCOLS`), busca último válido `skinfolds.protocol` (`user_id`, `measurement_date DESC, id DESC`) → `resolveInitialProtocol(last ?? 'jp7')`, `NULL` ignorado, sem `profiles.default_protocol`. Troca não apaga dobras, 9 dobras sempre visíveis, obrigatórios destacados via `PROTOCOLS` + `normalizeSex`, Petroski F sinaliza peso/altura. Edição usa `protocol` da medição; nova usa último válido. Helper `src/lib/nutrition/protocolDefault.ts`. Testes F3.2 (17) → 678 testes.

## DO-0001.0-F3.3 — 2026-09-11

Integração do protocolo persistido: `historico/page.tsx`, `dashboard/page.tsx`, `getPatientMetabolicData.ts`, `useAdminDashboard.ts` passam a usar `skinfolds.protocol` da própria medição (sem fallback JP7 para NULL); `timelineData` inclui `protocol, density, skinfoldId`, `sumFolds = comp.sum` (JP7/JP3/Petroski conforme). `DobrasSection` soma via `PROTOCOLS[protocol].sitesBySex[sex]` e associação por `skinfoldId` (sem `toFixed`). `contextBuilder` header dinâmico `JP3/JP7/Petroski4` ou `protocolo não registrado`. Nenhum `Σ9`, nenhum `JP7` fixo universal. Testes F3.3 (18) → 696 testes.

## DO-0001.0-F3.4 — 2026-09-11

Modelo auditável: `public.body_compositions` (FK `skinfold_id → skinfolds.id`, `user_id`, `measurement_date`, `protocol`, `protocol_version='2026-09-11'`, `method siri/brozek`, `sum/density/bf/fat_mass/lean_mass` sem arredondamento, `calculated_at`, `is_official` com índice único parcial `skinfold_id WHERE is_official`, `created_by`) — migration `20250914_create_body_compositions.sql`, RLS espelha `skinfolds` (admin/nutricionista). Fluxo: `skinfolds → calculateBodyComposition() → body_compositions` via `persistBodyComposition()` (desativa oficial anterior, insere novo), `simulateBodyComposition()` efêmero. Nova medição completa gera oficial; incompleta não persiste; `NULL` nunca vira zero; histórico antigo sem backfill; reprocessamento cria novo oficial sem apagar histórico. Service `src/lib/nutrition/bodyCompositionService.ts` (`PROTOCOL_VERSION`). Testes F3.4 (31) → 727 testes.

## DO-0001.0-F3.6 — 2026-09-11

Consumo oficial persistido: `body_compositions.is_official=true` é fonte quando existir (conjunto indivisível `protocol, protocol_version, method, sum, density, bf, fat_mass, lean_mass, calculated_at`). `historico/page.tsx` e `dashboard/page.tsx` priorizam oficial via `skinfold_id` (mapa em memória, sem N+1), fallback on-the-fly só se `protocol` válido e sem oficial; `NULL` → indisponível. `getPatientMetabolicData` e `useAdminDashboard` idem. `DobrasSection` já consome `timeline`; `getOfficialBodyComposition(skinfoldId)` adicionado ao service. Testes F3.6 (17) → 744 testes.

Encerramento da FASE 2: histórico sem Σ9, sem JP7 fixo, sem `toFixed` como chave, motor fonte única, 8 dobras universo, biceps preservado.

## DO-0001.0-F3.4 — 2026-09-11

Modelo auditável: `public.body_compositions` (FK `skinfold_id → skinfolds.id`, `user_id`, `measurement_date`, `protocol`, `protocol_version='2026-09-11'`, `method siri/brozek`, `sum/density/bf/fat_mass/lean_mass` sem arredondamento, `calculated_at`, `is_official` com índice único parcial `skinfold_id WHERE is_official`, `created_by`) — migration `20250914_create_body_compositions.sql`, RLS espelha `skinfolds` (admin/nutricionista). Fluxo: `skinfolds → calculateBodyComposition() → body_compositions` via `persistBodyComposition()` (desativa oficial anterior, insere novo), `simulateBodyComposition()` efêmero. Nova medição completa gera oficial; incompleta não persiste; `NULL` nunca vira zero; histórico antigo sem backfill; reprocessamento cria novo oficial sem apagar histórico. Service `src/lib/nutrition/bodyCompositionService.ts` (`PROTOCOL_VERSION`). Testes F3.4 (31) → 727 testes.

---

## Histórico anterior

- DO-000 — auditoria: identificação de sítios trocados, divergência Σ9 vs Σ7, fallback sexo, idade atual, sanidade, unidades, duplicação do motor.

F3.4 criou migration `body_compositions`; F3.3/F3.2 tiveram UI seletor/integração sem nova migration de dados; F1/F2 sem banco.
