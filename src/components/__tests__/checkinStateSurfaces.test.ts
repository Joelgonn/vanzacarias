import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Fase 2.2 — verificação estrutural das superfícies que exibem o estado do
// Check-in. O comportamento do hook é coberto em runtime por
// src/hooks/__tests__/useCheckinStatus.test.ts (jsdom).

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const sidebar = read('src/components/patient/PatientSidebar.tsx');
const header = read('src/components/Header.tsx');
const dashboard = read('src/app/dashboard/page.tsx');
const hook = read('src/hooks/useCheckinStatus.ts');
const focusCard = read('src/components/dashboard/FocusTodayCard.tsx');
const recoveryCard = read('src/components/dashboard/RecoveryTodayCard.tsx');

describe('Fase 2.2 — Sidebar e Drawer usam o estado explícito', () => {
  for (const [name, source] of [
    ['Sidebar', sidebar],
    ['Drawer', header],
  ] as const) {
    it(`${name} consome doneChecked/unavailable e delega a getCheckinNavState`, () => {
      expect(source).toContain('doneChecked: checkinChecked');
      expect(source).toContain('unavailable: checkinUnavailable');
      expect(source).toContain('getCheckinNavState');
      expect(source).toContain("checkinNavState === 'done'");
      expect(source).toContain("checkinNavState === 'loading'");
      expect(source).toContain("checkinNavState === 'unavailable'");
    });

    it(`${name} sinaliza carregamento/indisponibilidade e preserva a navegação`, () => {
      expect(source).toContain('aria-busy={isCheckinLoading || undefined}');
      expect(source).toContain('(estado indisponível)');
      // Continuam sendo links: o estado desconhecido não bloqueia a rota.
      expect(source).toContain('href={item.href}');
      // O check verde só aparece no estado confirmado.
      expect(source).not.toContain("item.id === 'checkin' && checkinDone");
    });
  }
});

describe('Fase 2.2 — Dashboard propaga o estado explícito aos motores', () => {
  it('prioriza unavailable, depois loading, depois done/pending', () => {
    expect(dashboard).toContain("if (checkinUnavailable) return 'unavailable'");
    expect(dashboard).toContain("if (loading) return 'loading'");
    expect(dashboard).toContain("return isCheckinDoneThisWeek ? 'done' : 'pending'");
  });

  it('injeta checkinStatus no FocusInput usado por foco e recuperação', () => {
    expect(dashboard).toContain('checkinStatus,');
    expect(dashboard).toContain('getFocus(focusInput)');
    expect(dashboard).toContain('getRecovery(recoveryInput)');
  });
});

describe('Fase 2.2 — hook expõe indisponibilidade', () => {
  it('trata erro da consulta e retorna unavailable', () => {
    expect(hook).toContain('if (error) throw error;');
    expect(hook).toContain('setUnavailable(true)');
    expect(hook).toContain('setUnavailable(false)');
    expect(hook).toContain('return { isDone, doneChecked, unavailable };');
  });
});

describe('Fase 2.2 — cards auxiliares não interpretam o booleano bruto', () => {
  it('cards renderizam apenas ações já decididas pelos motores', () => {
    for (const source of [focusCard, recoveryCard]) {
      expect(source).not.toContain('isCheckinDoneThisWeek');
      expect(source).toContain('result.actions');
    }
  });
});
