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

// VOZ-012.2 — Formatação do cronômetro de gravação (M:SS, 0:00–0:59 conforme CHAT-UX-004).
export function formatElapsedMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const mm = String(Math.floor(totalSeconds / 60));
  return `${mm}:${ss}`;
}

export type UseVoiceInputOptions = {
  onTranscript?: (text: string) => void;
  controllerOptions?: Omit<VoiceControllerOptions, 'onTranscript' | 'onError' | 'onStatusChange'>;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const controllerRef = useRef<VoiceInputController | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext === true && !!navigator.mediaDevices?.getUserMedia;
  });

  // VOZ-012.2 — cronômetro de gravação (parede, não tempo estimado de áudio).
  // Roda APENAS enquanto status === 'recording'; zera em qualquer outra transição,
  // garantindo que não continue durante PROCESSANDO/TRANSCRIBENDO e reinicia em 00:00
  // a cada nova gravação.
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status === 'recording') {
      startedAtRef.current = Date.now();
      setRecordingElapsedMs(0);
      tickRef.current = setInterval(() => {
        if (startedAtRef.current != null) setRecordingElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      startedAtRef.current = null;
      setRecordingElapsedMs(0);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      startedAtRef.current = null;
    };
  }, [status]);

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

  const isBusy = status === 'loading' || status === 'recording' || status === 'processing' || status === 'transcribing';

  return {
    status,
    transcript,
    error,
    recordingElapsedMs,
    isSupported,
    isBusy,
    isRecording: status === 'recording',
    start,
    stop,
    cancel,
    reset,
  };
}