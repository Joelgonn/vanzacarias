// VOZ-001.4 — Captura de áudio isolada (não depende do chatbot)
// Objetivo: fornecer PCM 16kHz mono para Moonshine sem assumir que constraints são respeitadas.

import { isVoiceDebugEnabled, voiceDebugLog } from '../debug';

export type CaptureConstraints = {
  sampleRate: number; // alvo 16000 (Moonshine raw waveform)
  channelCount: 1;
  echoCancellation: false;
  noiseSuppression: false;
  autoGainControl: false;
};

export type CaptureResult = {
  stream: MediaStream;
  audioContext: AudioContext;
  actualSettings: MediaTrackSettings;
  sampleRate: number;
  cleanup: () => void;
};

export type CaptureErrorCode = 'not-supported' | 'permission_denied' | 'not-found' | 'not-allowed' | 'aborted' | 'unknown';

export class CaptureError extends Error {
  code: CaptureErrorCode;
  constructor(code: CaptureErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Verifica se a captura é suportada no navegador atual.
 */
export function isCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Tenta capturar microfone com constraints ideais (16kHz mono, sem processamento).
 * Verifica settings reais via MediaTrackSettings (não assume que browser respeitou).
 * Retorna stream + AudioContext para posterior PCM.
 */
export async function captureAudio(targetSampleRate = 16000): Promise<CaptureResult> {
  if (!isCaptureSupported()) {
    throw new CaptureError('not-supported', 'getUserMedia não suportado neste navegador');
  }

  const constraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      sampleRate: targetSampleRate,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    } as any,
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e: any) {
    const name = e?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new CaptureError('permission_denied', 'Permissão de microfone negada');
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new CaptureError('not-found', 'Nenhum microfone encontrado');
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      throw new CaptureError('aborted', 'Microfone em uso por outro aplicativo');
    }
    throw new CaptureError('unknown', e?.message || 'Falha ao acessar microfone');
  }

  const track = stream.getAudioTracks()[0];
  const actualSettings = track.getSettings() as MediaTrackSettings;

  // AudioContext para PCM e resampling se necessário.
  // Não assume sampleRate 16k — verifica e faz resample depois.
  // VOZ-008.5-R1 — Criação robusta: fallback sem sampleRate explícito se renderer falhar (Chrome Android 48k mismatch)
  let audioContext: AudioContext;
  const ctxRate = (actualSettings.sampleRate as number) || targetSampleRate;
  try {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: ctxRate,
        latencyHint: 'interactive',
      } as any);
    } catch (e: any) {
      // Fallback sem sampleRate explícito — deixa browser escolher nativo (evita renderer error em Android)
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('AUDIOCONTEXT_CREATE_FALLBACK', {
          requestedRate: ctxRate,
          error: e?.message || String(e),
        });
      }
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  } catch (e: any) {
    stream.getTracks().forEach(t => t.stop());
    throw new CaptureError('unknown', 'AudioContext não disponível');
  }

  // VOZ-008.5 — Garantir AudioContext running no Android (suspended/interrupted → resume)
  const stateBefore: string = (audioContext.state as string) ?? 'unknown';
  let resumeAttempted = false;
  let resumeSucceeded = false;
  const isInterruptedOrSuspended =
    typeof audioContext.state === 'string' &&
    ((audioContext.state as string) === 'suspended' || (audioContext.state as string) === 'interrupted');
  if (isInterruptedOrSuspended) {
    resumeAttempted = true;
    if (typeof audioContext.resume === 'function') {
      try {
        await audioContext.resume();
        resumeSucceeded = (audioContext.state as string) === 'running';
      } catch (e: any) {
        resumeSucceeded = false;
        if (isVoiceDebugEnabled()) {
          voiceDebugLog('AUDIOCONTEXT_RESUME_ERROR', {
            stateBefore,
            error: e?.message || String(e),
          });
        }
      }
    } else {
      resumeSucceeded = false;
    }
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('AUDIOCONTEXT_RESUME', {
        stateBefore,
        resumeAttempted,
        stateAfter: audioContext.state as string,
        resumeSucceeded,
      });
    }
    if ((audioContext.state as string) !== 'running') {
      stream.getTracks().forEach(t => t.stop());
      try { if ((audioContext.state as string) !== 'closed') audioContext.close(); } catch {}
      throw new CaptureError('unknown', `AudioContext não está em running (estado: ${audioContext.state})`);
    }
  } else if (isVoiceDebugEnabled()) {
    voiceDebugLog('AUDIOCONTEXT_RESUME', {
      stateBefore,
      resumeAttempted: false,
      stateAfter: audioContext.state as string,
      resumeSucceeded: true,
    });
  }

  const cleanup = () => {
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    try { if (audioContext.state !== 'closed') audioContext.close(); } catch {}
  };

  return {
    stream,
    audioContext,
    actualSettings,
    sampleRate: audioContext.sampleRate,
    cleanup,
  };
}

/**
 * Helpers para validação de formato — usados pelo STT para decidir se precisa resample.
 */
export function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/**
 * Converte Float32 (AudioContext) para Int16 PCM 16k mono se necessário.
 * Suporta resampling simples (downsample) quando ctxRate != 16000.
 */
export function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// VOZ-006 — Gravação contínua de PCM a partir de um stream já capturado.
// Reutiliza AudioContext/stream existentes (captureAudio) e acumula Float32
// enquanto ativo; stop() devolve o PCM concatenado na taxa do AudioContext.
// Mesmo padrão do lab (ScriptProcessorNode), extraído para uso na integração.
export type PcmRecorder = {
  start: () => void;
  stop: () => Float32Array;
  cancel: () => void;
  cleanup: () => void;
};

export function createPcmRecorder(
  stream: MediaStream,
  audioContext: AudioContext,
  chunkSize = 4096
): PcmRecorder {
  // VOZ-008.5-R1 — Criação robusta com tratamento de renderer error (Android)
  let source: MediaStreamAudioSourceNode;
  let processor: ScriptProcessorNode;
  try {
    source = audioContext.createMediaStreamSource(stream);
  } catch (e: any) {
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('PCMRECORDER_SOURCE_ERROR', {
        audioContextState: (audioContext.state as string) ?? 'unknown',
        error: e?.message || String(e),
      });
    }
    throw new CaptureError('unknown', `createMediaStreamSource falhou: ${e?.message || e}`);
  }
  try {
    processor = audioContext.createScriptProcessor(chunkSize, 1, 1);
  } catch (e: any) {
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('PCMRECORDER_PROCESSOR_ERROR', {
        audioContextState: (audioContext.state as string) ?? 'unknown',
        chunkSize,
        error: e?.message || String(e),
      });
    }
    try { source.disconnect(); } catch {}
    throw new CaptureError('unknown', `createScriptProcessor falhou: ${e?.message || e}`);
  }
  const chunks: Float32Array[] = [];
  let active = false;
  let finished = false;

  processor.onaudioprocess = (e) => {
    if (!active || finished) return;
    if (e.inputBuffer.numberOfChannels === 0) return;
    // Monocanal: recebe apenas o canal 0 (constraints pedem channelCount=1).
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  const teardown = () => {
    try { source.disconnect(); } catch {}
    try { processor.disconnect(); } catch {}
  };

  return {
    start() {
      active = true;
      source.connect(processor);
      processor.connect(audioContext.destination);
    },
    stop() {
      finished = true;
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const out = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.length; }
      chunks.length = 0;
      teardown();
      return out;
    },
    cancel() {
      finished = true;
      chunks.length = 0;
      teardown();
    },
    cleanup() {
      finished = true;
      chunks.length = 0;
      teardown();
    },
  };
}

export function resampleTo16k(input: Float32Array, inputRate: number, targetRate = 16000): Float32Array {
  const inputSamples = input.length;
  const inputDurationMs = inputRate > 0 ? Math.round((inputSamples / inputRate) * 1000) : 0;
  if (inputRate === targetRate) {
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('RESAMPLING', {
        inputSamples,
        inputRate,
        inputDurationMs,
        outputSamples: inputSamples,
        outputRate: targetRate,
        outputDurationMs: inputDurationMs,
        durationRatio: 1,
        bypassed: true,
      });
    }
    return input;
  }
  const ratio = inputRate / targetRate;
  const newLen = Math.round(input.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = i * ratio;
    const idx0 = Math.floor(idx);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = idx - idx0;
    out[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
  }
  if (isVoiceDebugEnabled()) {
    const outputDurationMs = Math.round((newLen / targetRate) * 1000);
    voiceDebugLog('RESAMPLING', {
      inputSamples,
      inputRate,
      inputDurationMs,
      outputSamples: newLen,
      outputRate: targetRate,
      outputDurationMs,
      durationRatio: inputDurationMs > 0 ? Number((outputDurationMs / inputDurationMs).toFixed(3)) : 0,
      bypassed: false,
    });
  }
  return out;
}
