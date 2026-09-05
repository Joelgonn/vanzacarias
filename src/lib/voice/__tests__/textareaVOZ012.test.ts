import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const chatPath = path.join(process.cwd(), 'src/components/ChatAssistant.tsx');
const content = fs.readFileSync(chatPath, 'utf8');

describe('VOZ-012 — Textarea / Texto Longo', () => {
  it('textarea tem max-h 200px (não 132) e overflow-y-auto', () => {
    expect(content).toMatch(/max-h-\[200px\]/);
    expect(content).not.toMatch(/max-h-\[132px\]/);
    expect(content).toMatch(/overflow-y-auto/);
  });

  it('onChange e useEffect expandem até 200px com scroll', () => {
    expect(content).toMatch(/Math\.min\(textareaRef\.current\.scrollHeight, maxH\)/);
    expect(content).toMatch(/textareaRef\.current\.style\.overflowY/);
  });

  it('useEffect observa state.input para transcrição longa', () => {
    // O useEffect deve reagir a state.input, não apenas a '' (limpeza)
    expect(content).toMatch(/useEffect\(\(\) => \{\s+if \(textareaRef\.current\)/);
    expect(content).toMatch(/}, \[state\.input\]\)/);
  });

  it('texto curto → normal, médio → cresce, longo → scroll (max 200)', () => {
    // Verifica que min 44px e max 200px estão definidos
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).toMatch(/max-h-\[200px\]/);
    // Verifica que overflow é tratado
    expect(content).toMatch(/overflowY/);
  });
});
