import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// =========================================================================
// Fiação do onboarding — quatro etapas.
// Padrão do projeto: inspeção de fonte (vitest em node), complementada pela
// validação funcional documentada no relatório. O comportamento puro da
// máquina de estados é coberto em patientJourney.test.ts.
// =========================================================================

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const dashboard = read('src/app/dashboard/page.tsx');
const nextBestAction = read('src/components/dashboard/NextBestAction.tsx');
const qfaForm = read('src/components/QFAForm.tsx');
const perfilPage = read('src/app/dashboard/perfil/page.tsx');
const completarPerfil = read('src/app/dashboard/completar-perfil/page.tsx');
const cadastro = read('src/app/cadastro/page.tsx');
const redirectHook = read('src/hooks/useOnboardingRedirect.ts');
const onboardingLoader = read('src/lib/onboarding/loadOnboardingState.ts');
const checkinForm = read('src/components/CheckinForm.tsx');
const useCheckinStatus = read('src/hooks/useCheckinStatus.ts');

describe('Dashboard — fonte única da jornada', () => {
  it('usa getPatientJourneyState e entrega o snapshot ao progresso e ao próximo passo', () => {
    expect(dashboard).toContain('getPatientJourneyState({');
    expect(dashboard).toContain('setJourney(journeySnapshot)');
    expect(dashboard).toContain('<OnboardingProgress snapshot={journey} onRetry={loadData} />');
    expect(dashboard).toContain('journey={journey}');
  });

  it('distingue perfil inexistente (PGRST116) de falha real de consulta', () => {
    expect(dashboard).toContain(
      "const profileQueryFailed = !!profileError && profileError.code !== 'PGRST116';"
    );
    expect(dashboard).toContain('perfilBasicoError: profileQueryFailed');
    expect(dashboard).toContain('perfilAlimentarError: profileQueryFailed');
  });

  it('falha do QFA e do check-in chegam como unavailable, não como pendência', () => {
    expect(dashboard).toContain("qfaError: !!qfaError");
    expect(dashboard).toContain("checkinError: !!checkinError");
    expect(dashboard).toContain("setQfaUnavailable(journeySnapshot.raioX === 'unavailable')");
    expect(dashboard).toContain(
      "setCheckinUnavailable(journeySnapshot.checkin === 'unavailable')"
    );
  });

  it('banner de QFA só aparece quando a pendência é confirmada', () => {
    expect(dashboard).toContain('{!hasCompletedQFA && !qfaUnavailable && (');
  });

  it('não renderiza a jornada antes do fim do carregamento', () => {
    const loadingGate = dashboard.indexOf('if (loading) return');
    const journey = dashboard.indexOf('<NextBestAction');
    expect(loadingGate).toBeGreaterThan(-1);
    expect(journey).toBeGreaterThan(loadingGate);
  });
});

describe('Gate de entrada — apenas /dashboard', () => {
  it('redireciona com router.replace somente na rota exata /dashboard', () => {
    expect(redirectHook).toContain("pathname === '/dashboard'");
    expect(redirectHook).toContain('router.replace(targetRoute)');
  });

  it('nunca redireciona quando alguma consulta está indisponível', () => {
    expect(redirectHook).toContain('!hasUnavailable &&');
  });

  it('rotas de etapa continuam acessíveis para correção', () => {
    expect(redirectHook).not.toContain("startsWith('/dashboard')");
  });
});

describe('NextBestAction — prioridade centralizada', () => {
  it('consome journey.nextAction na ordem Perfil → Alimentar → Raio-X → Check-in', () => {
    const perfil = nextBestAction.indexOf("if (next === 'perfil') return 'perfil';");
    const alimentar = nextBestAction.indexOf(
      "if (next === 'perfilAlimentar') return 'perfilAlimentar';"
    );
    const raioX = nextBestAction.indexOf("if (next === 'raioX') return 'raioX';");
    const checkin = nextBestAction.indexOf("if (next === 'checkin') return 'checkin';");

    expect(perfil).toBeGreaterThan(-1);
    expect(alimentar).toBeGreaterThan(perfil);
    expect(raioX).toBeGreaterThan(alimentar);
    expect(checkin).toBeGreaterThan(raioX);
  });

  it('primeiro check-in de onboarding não é bloqueado por premium/trial', () => {
    const nextCheckin = nextBestAction.indexOf("if (next === 'checkin') return 'checkin';");
    const premiumRule = nextBestAction.indexOf('!input.isLocked');
    expect(nextCheckin).toBeGreaterThan(-1);
    // A checagem de premium só aparece depois da decisão de onboarding.
    expect(premiumRule).toBeGreaterThan(nextCheckin);
  });

  it('etapa indisponível não é marcada como pendente nem como concluída', () => {
    expect(nextBestAction).toContain(
      "const perfilPending = journey.perfil === 'not_started';"
    );
    expect(nextBestAction).toContain(
      "const perfilAlimentarPending = journey.perfilAlimentar === 'not_started';"
    );
    expect(nextBestAction).toContain(
      "const raioXPending = journey.raioX === 'not_started';"
    );
    expect(nextBestAction).toContain("pending: perfilPending");
    expect(nextBestAction).toContain("pending: perfilAlimentarPending");
    expect(nextBestAction).toContain("pending: raioXPending");
    expect(nextBestAction).toContain("hint: perfilUnavailable ? 'Indisponível'");
    expect(nextBestAction).toContain("hint: raioXUnavailable ? 'Indisponível'");
  });
});

describe('Persistência confirmada — sem sucesso falso', () => {
  it('QFA confirma a linha salva via select', () => {
    expect(qfaForm).toContain(".select('user_id')");
    expect(qfaForm).toContain('if (!savedRow)');
    expect(qfaForm).toContain("throw new Error('Não foi possível confirmar o salvamento");
  });

  it('"Não, como de tudo" persiste lista vazia e confirma o update', () => {
    expect(qfaForm).toContain('const handleNoRestrictions = async () => {');
    expect(qfaForm).toContain('.update({ food_restrictions: [] })');
    expect(qfaForm).toContain(".select('id')");
    expect(qfaForm).toContain('if (!data)');
  });

  it('QFA trata erro de consulta como erro com retry, não como ausência', () => {
    expect(qfaForm).toContain('setLoadError(');
    expect(qfaForm).toContain('Tentar novamente');
    expect(qfaForm).toContain('setRetryCount((count) => count + 1)');
  });

  it('links do QFA apontam para a rota real do perfil alimentar', () => {
    expect(qfaForm).toContain("router.push('/dashboard/completar-perfil')");
    expect(qfaForm).toContain("router.push('/dashboard/completar-perfil?from=qfa')");
    expect(qfaForm).not.toContain("router.push('/completar-perfil'");
  });

  it('perfil básico faz upsert confirmado pelo id da sessão', () => {
    expect(perfilPage).toContain("import { isPerfilBasicoComplete } from '@/lib/patientJourney';");
    expect(perfilPage).toContain('.upsert(');
    expect(perfilPage).toContain('id: session.user.id');
    expect(perfilPage).toContain(".select('id')");
    expect(perfilPage).toContain('if (error || !data)');
  });

  it('perfil alimentar confirma o update e trata 0 linhas como falha', () => {
    expect(completarPerfil).toContain('.update({');
    expect(completarPerfil).toContain(".select('id')");
    expect(completarPerfil).toContain('if (error || !data)');
    expect(completarPerfil).toContain('isValidBirthDate');
  });

  it('cadastro não exibe sucesso quando a criação do perfil falha', () => {
    expect(cadastro).toContain('if (profileError) {');
    expect(cadastro).toContain('setError(');
    expect(cadastro).toContain('return;');
  });

  it('formulários conduzem à próxima etapa central, não ao dashboard fixo', () => {
    expect(onboardingLoader).toContain('resolveNextOnboardingRoute');
    expect(perfilPage).toContain('resolveNextOnboardingRoute(supabase, session.user.id)');
    expect(completarPerfil).toContain('resolveNextOnboardingRoute(supabase, session.user.id)');
  });
});

describe('Contrato do evento patient:checkin-updated', () => {
  it('só dispara depois do insert bem-sucedido', () => {
    const throwIndex = checkinForm.indexOf('if (error) throw error;');
    const dispatchIndex = checkinForm.indexOf(
      "dispatchEvent(new CustomEvent('patient:checkin-updated'))"
    );
    expect(throwIndex).toBeGreaterThan(-1);
    expect(dispatchIndex).toBeGreaterThan(throwIndex);
  });

  it('registra e remove o listener no ciclo de vida do componente', () => {
    expect(useCheckinStatus).toContain(
      "window.addEventListener('patient:checkin-updated', handler)"
    );
    expect(useCheckinStatus).toContain(
      "window.removeEventListener('patient:checkin-updated', handler)"
    );
  });

  it('falha na reconsulta não conclui o check-in', () => {
    const catchBlock = useCheckinStatus.slice(
      useCheckinStatus.indexOf('} catch {'),
      useCheckinStatus.indexOf('} finally {')
    );
    expect(catchBlock).toContain('setIsDone(false)');
    expect(catchBlock).not.toContain('setIsDone(true)');
  });

  it('falha no salvamento não dispara o evento de atualização', () => {
    const submitStart = checkinForm.indexOf('const handleSubmit');
    const catchStart = checkinForm.indexOf('} catch (error) {', submitStart);
    const catchEnd = checkinForm.indexOf('} finally {', catchStart);
    const catchBlock = checkinForm.slice(catchStart, catchEnd);
    expect(submitStart).toBeGreaterThan(-1);
    expect(catchStart).toBeGreaterThan(-1);
    expect(catchBlock).toContain('toast.error');
    expect(catchBlock).not.toContain('dispatchEvent');
  });
});
