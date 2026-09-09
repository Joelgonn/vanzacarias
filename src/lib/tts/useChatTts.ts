'use client';

// TTS-INTEGRATION-003 — Hook do Chat para o TTS (camada fina sobre o controller,
// espelhando o padrão de `useVoiceInput`). Usado pelo ChatAssistant e pelas
// opções de configuração (Settings) com a MESMA fonte de verdade (§D04).

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import {
  createChatTtsController,
  type ChatTtsController,
  type ChatTtsUiState,
} from './chatTtsController';
import type { TtsOrchestrator } from './orchestrator';

/**
 * Factory lazy: import dinâmico do synthesizer + player + orchestrator.
 * O dynamic import() cria um chunk separado no webpack, evitando que os
 * binários nativos do onnxruntime-node entrem no bundle principal do cliente.
 */
async function lazyCreateOrchestrator(): Promise<TtsOrchestrator> {
  const [
    { createTtsService },
    { createAudioPlayer },
    { createTtsOrchestrator },
  ] = await Promise.all([
    import(/* webpackChunkName: "tts-engine" */ './synthesizer'),
    import('./player'),
    import('./orchestrator'),
  ]);

  const service = createTtsService({ model: 'q8', voice: 'pf_dora' });
  const player = createAudioPlayer();
  return createTtsOrchestrator({ tts: service, player });
}

export type UseChatTtsOptions = {
  /** Controller opcional (testes / casos em que o dono gerencia o ciclo de vida). */
  controller?: ChatTtsController;
};

export function useChatTts(options: UseChatTtsOptions = {}) {
  // Lazy init estável (React 19 pattern p/ evitar ref-during-render).
  const [controller] = useState<ChatTtsController>(
    () =>
      options.controller ??
      createChatTtsController({ createOrchestrator: lazyCreateOrchestrator }),
  );

  const ui = useSyncExternalStore<ChatTtsUiState>(
    useCallback((cb: () => void) => controller.subscribe(cb), [controller]),
    () => controller.getUiSnapshot(),
    () => controller.getUiSnapshot(),
  );

  useEffect(() => {
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  const toggle = useCallback(() => controller.toggleAction(), [controller]);
  const replay = useCallback(() => controller.replay(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const setEnabled = useCallback((enabled: boolean) => controller.setEnabled(enabled), [controller]);
  const noteResponse = useCallback((markdown: string) => controller.noteResponse(markdown), [controller]);
  const invalidate = useCallback(() => controller.invalidate(), [controller]);
  /** TTS-PROD-FIX-001: desbloqueia o AudioContext dentro do gesto (send/toggle). */
  const unlock = useCallback(() => {
    void controller.unlock();
  }, [controller]);

  return { ui, toggle, replay, stop, setEnabled, noteResponse, invalidate, unlock };
}