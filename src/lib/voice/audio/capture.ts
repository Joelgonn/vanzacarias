// VOZ-001.4 — Captura de áudio isolada (não depende do chatbot)
// Objetivo: fornecer PCM 16kHz mono para Moonshine sem assumir que constraints são respeitadas.

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
  let audioContext: AudioContext;
  try {
    // Usa sampleRate real do track se disponível, caso contrário target.
    const ctxRate = (actualSettings.sampleRate as number) || targetSampleRate;
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: ctxRate });
  } catch (e: any) {
    stream.getTracks().forEach(t => t.stop());
    throw new CaptureError('unknown', 'AudioContext não disponível');
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

export function resampleTo16k(input: Float32Array, inputRate: number, targetRate = 16000): Float32Array {
  if (inputRate === targetRate) return input;
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
  return out;
}
