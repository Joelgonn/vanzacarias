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

  it('auto-grow aplica scrollHeight → altura até 200px com scroll (CHAT-UX-008)', () => {
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    expect(content).toMatch(/el\.style\.height = `\$\{heightPx\}px`/);
    expect(content).toMatch(/el\.style\.overflowY = overflowY/);
  });

  it('useLayoutEffect observa state.input e foco (render → medir, antes da pintura)', () => {
    expect(content).toMatch(/useLayoutEffect\(\(\) => \{\s+const el = textareaRef\.current/);
    expect(content).toMatch(/resizeComposer\(\);/);
    expect(content).toMatch(/\}, \[state\.input, isComposerFocused\]\)/);
  });

  it('texto curto → normal, médio → cresce, longo → scroll (max 200)', () => {
    // Verifica que min 44px e max 200px estão definidos
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).toMatch(/max-h-\[200px\]/);
    // Verifica que overflow é tratado
    expect(content).toMatch(/overflowY/);
  });
});
