import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// CHAT-SUG-002 — Smart Suggestions: catálogo determinístico + integração no
// ChatAssistant (empty state e pós-resposta). Padrão do projeto: vitest em
// node via inspeção de fonte (mesmo do composerCOMPOSER001.test.ts).

const chatPath = path.join(process.cwd(), 'src/components/ChatAssistant.tsx');
const content = fs.readFileSync(chatPath, 'utf8');
const modulePath = path.join(process.cwd(), 'src/lib/smartSuggestions.ts');
const moduleSrc = fs.readFileSync(modulePath, 'utf8');
const dashPath = path.join(process.cwd(), 'src/app/dashboard/page.tsx');

const getSuggestionsBlock = (): string => {
  const idx = content.indexOf('role="group" aria-label="Sugestões"');
  if (idx === -1) throw new Error('bloco de sugestões não encontrado');
  return content.slice(content.lastIndexOf('<div ', idx), idx + 4000);
};

const getSuggestionLogic = (): string => {
  const start = content.indexOf('// Smart Suggestions (CHAT-SUG-002)');
  const end = content.indexOf('const renderSuggestionChips = () => (');
  if (start === -1 || end === -1) throw new Error('lógica de sugestões não encontrada');
  return content.slice(start, end);
};

describe('CHAT-SUG-002 — Smart Suggestions (UX estrutural)', () => {
  it('SUG-01 — bloco renderiza 1 botão por sugestão; contagem 3 garantida pelo seletor', () => {
    const block = getSuggestionsBlock();
    expect(block).toContain('suggestions.map((s) =>');
    expect(block).toMatch(/role="group" aria-label="Sugestões"/);
    // invariante de contagem vive no seletor (coberto em smartSuggestions.test.ts)
    expect(moduleSrc).toContain('const targetCount = opts?.count ?? 3;');
    expect(moduleSrc).toContain('return applyIntentDiversity(ordered, targetCount);');
  });

  it('SUG-02 — clique dispara handleAsk (mesmo fluxo de envio do paciente)', () => {
    const block = getSuggestionsBlock();
    expect(block).toMatch(/onClick=\{\(\) => handleAsk\(s\.label\)\}/);
    expect(content).toContain('const handleAsk = async (text: string) => {');
    expect(content).toContain('await patientLogic.ask(text);');
  });

  it('SUG-03 — admin nunca recebe sugestões (empty state e pós-resposta)', () => {
    expect(getSuggestionLogic()).toContain('if (isRoleAdmin) return [];');
    const empty = content.slice(content.indexOf('{state.messages.length === 0 && ('));
    expect(empty).toContain('{!isRoleAdmin && renderSuggestionChips()}');
    expect(content).toContain('{showAfterResponse && renderSuggestionChips()}');
  });

  it('SUG-04 — oculto durante loading/streaming; reexibido após resposta; erro não recalcula', () => {
    const condStart = content.indexOf('const showAfterResponse =');
    const cond = content.slice(condStart, condStart + 400);
    expect(cond).toContain('!state.isLoading');
    expect(cond).toContain('!state.streamingText');
    expect(cond).toContain("lastMessage.role === 'assistant'");
    expect(cond).toContain('!lastMessage.isError');
  });

  it('SUG-05 — seleção determinística no frontend, sem Date.now no algoritmo', () => {
    const logic = getSuggestionLogic();
    expect(logic).toContain('selectSuggestions(suggestionContext, {');
    expect(logic).toContain('seed: suggestionRotation');
    expect(logic).toContain('rotationIndex: suggestionRotation');
    expect(logic).toContain('lastIds: lastSuggestionIdsRef.current');
    expect(logic).toContain('const lastSuggestionIdsRef = useRef<string[]>([]);');
    expect(logic).not.toContain('Date.now');
  });

  it('SUG-06 — pills preservam o padrão visual validado + a11y', () => {
    const block = getSuggestionsBlock();
    expect(block).toMatch(/min-h-\[44px\] px-4 py-2 rounded-full bg-white border border-stone-200/);
    expect(block).toMatch(/hover:border-nutri-200.*hover:text-nutri-700.*hover:bg-nutri-50/);
    expect(block).toContain('type="button"');
    expect(block).toContain('disabled={state.isLoading}');
    expect(block).toMatch(/role="group" aria-label="Sugestões"/);
    expect(block).toContain('active:scale-95');
  });

  it('SUG-07 — smartContext é prop opcional e alimenta o contexto da seleção', () => {
    expect(content).toContain('smartContext?: SmartSuggestDashboardFlags');
    expect(content).toContain('...smartContext,');
    expect(content).toContain("from '@/lib/smartSuggestions'");
  });

  it('SUG-08 — Composer/header/layout permanecem intactos (regressão de estrutura)', () => {
    expect(content).toMatch(/COMPOSER_IDLE_AREAS/);
    expect(content).toMatch(/COMPOSER_EDIT_AREAS/);
    expect(content).toMatch(/\[grid-area:input\]/);
    expect(content).toMatch(/\[grid-area:attach\]/);
    expect(content).toMatch(/\[grid-area:mic\]/);
    expect(content).toMatch(/\[grid-area:send\]/);
    expect(content).toMatch(/capture="environment"/);
    expect(content).toMatch(/accept="image\/\*"/);
    expect(content).toMatch(/role="dialog"/);
  });

  it('SUG-09 — Dashboard povoa o smartContext apenas com sinais já computados', () => {
    const dash = fs.readFileSync(dashPath, 'utf8');
    expect(dash).toContain('smartContext={{');
    expect(dash).toContain('checkinsCount: checkins.length,');
    expect(dash).toContain('isMealPlanReady');
    expect(dash).toContain('waterProgress');
    expect(dash).toContain('isCheckinDoneThisWeek');
    expect(dash).toContain('hasCompletedQFA');
  });

  it('SUG-10 — sem constante legada QUICK_ACTIONS no ChatAssistant', () => {
    expect(content).not.toContain('const QUICK_ACTIONS_FREE');
    expect(content).not.toContain('const QUICK_ACTIONS_PREMIUM');
    expect(content).not.toContain('canAccessMealPlan ? QUICK_ACTIONS_PREMIUM : QUICK_ACTIONS_FREE');
  });
});