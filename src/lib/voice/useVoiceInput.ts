'use client';

// VOZ-006 — Hook de entrada por voz para o ChatAssistant.
// Camada fina sobre VoiceInputController: espelha status/transcript/error
// para o estado React e faz dispose automático ao desmontar.
//
// O hook NÃO envia mensagens: apenas entrega o texto via onTranscript,
// que o ChatAssistant injeta no input (sem auto-send).

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  VoiceInputController,
  type VoiceStatus,
  type VoiceInputError,
  type VoiceControllerOptions,
} from './voiceController';

export type UseVoiceInputOptions = {
  onTranscript?: (text: string) => void;
  controllerOptions?: Omit<VoiceControllerOptions, 'onTranscript' | 'onError' | 'onStatusChange'>;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const controllerRef = useRef<VoiceInputController | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext === true && !!navigator.mediaDevices?.getUserMedia;
  });

  useEffect(() => {
    const controller = new VoiceInputController({
      engineId: 'vosk-pt-br',
      ...(options.controllerOptions ?? {}),
      onStatusChange: setStatus,
      onTranscript: (text) => {
        setTranscript(text);
        options.onTranscript?.(text);
      },
      onError: setError,
    });
    controllerRef.current = controller;
    setIsSupported(controller.isSupported().secure && controller.isSupported().hasCapture && !!controller.isSupported().engineOk);
    return () => {
      controllerRef.current = null;
      void controller.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    setError(null);
    void controllerRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    void controllerRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setTranscript('');
    controllerRef.current?.reset();
  }, []);

  const isBusy = status === 'loading' || status === 'recording' || status === 'transcribing';

  return {
    status,
    transcript,
    error,
    isSupported,
    isBusy,
    isRecording: status === 'recording',
    start,
    stop,
    cancel,
    reset,
  };
}