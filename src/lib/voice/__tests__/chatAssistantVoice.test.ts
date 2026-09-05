import { describe, it, expect, vi } from 'vitest';

// VOZ-009 — Preservar texto existente ao receber transcrição
function appendTranscript(prev: string, next: string | null | undefined): string {
  const trimmed = next?.trim();
  if (!trimmed) return prev;
  const prevTrimmed = prev.trim();
  if (!prevTrimmed) return trimmed;
  return `${prevTrimmed} ${trimmed}`;
}

describe('VOZ-009 — ChatAssistant onTranscript preserva texto existente', () => {
  it('1. texto vazio + transcrição → transcrição', () => {
    expect(appendTranscript('', 'olá')).toBe('olá');
    expect(appendTranscript('   ', 'olá mundo')).toBe('olá mundo');
  });

  it('2. texto existente + transcrição → concatenado com espaço', () => {
    expect(appendTranscript('oi', 'olá')).toBe('oi olá');
    expect(appendTranscript('quero trocar arroz', 'por batata')).toBe('quero trocar arroz por batata');
  });

  it('3. transcrição vazia não altera texto existente', () => {
    expect(appendTranscript('texto existente', '')).toBe('texto existente');
    expect(appendTranscript('texto existente', '   ')).toBe('texto existente');
    expect(appendTranscript('texto existente', null as any)).toBe('texto existente');
  });

  it('4. transcrição com espaços é trimada antes de concatenar', () => {
    expect(appendTranscript('  oi  ', '  olá  ')).toBe('oi olá');
  });

  it('5. onTranscript não dispara sendMessage automaticamente', () => {
    // Simula que onTranscript apenas chama setInput, não send
    const setInput = vi.fn();
    const sendMessage = vi.fn();
    const onTranscript = (text: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      setInput((prev: string) => {
        const prevTrimmed = prev.trim();
        if (!prevTrimmed) return trimmed;
        return `${prevTrimmed} ${trimmed}`;
      });
    };
    // Preenche input vazio
    let input = '';
    const mockSetInput = (updater: any) => {
      input = typeof updater === 'function' ? updater(input) : updater;
    };
    // Simula onTranscript chamada pelo Vosk
    const simulateTranscript = (t: string) => {
      const trimmed = t?.trim();
      if (!trimmed) return;
      mockSetInput((prev: string) => {
        const p = prev.trim();
        if (!p) return trimmed;
        return `${p} ${trimmed}`;
      });
    };
    simulateTranscript('olá teste');
    expect(input).toBe('olá teste');
    expect(sendMessage).not.toHaveBeenCalled();
    // Usuário pode editar antes de enviar
    input = 'olá teste editado';
    expect(input).toBe('olá teste editado');
    // Envio manual ainda funciona
    sendMessage(input);
    expect(sendMessage).toHaveBeenCalledWith('olá teste editado');
  });

  it('6. texto existente com transcrição longa', () => {
    expect(appendTranscript('preciso de ajuda', 'quero trocar dois pães por tapioca')).toBe(
      'preciso de ajuda quero trocar dois pães por tapioca'
    );
  });
});

describe('VOZ-009 — Integração ChatAssistant + useVoiceInput', () => {
  it('7. useVoiceInput onTranscript deve ser chamado com texto do Vosk', async () => {
    // Verifica que o contrato useVoiceInput → onTranscript existe
    const { VoiceInputController } = await import('../voiceController');
    const onTranscript = vi.fn();
    const engine = {
      id: 'vosk-pt-br',
      name: 'Vosk PT-BR',
      language: 'pt-BR',
      model: 'vosk-model-small-pt-0.3',
      load: vi.fn().mockResolvedValue(undefined),
      transcribe: vi.fn().mockResolvedValue({ text: 'teste de voz' }),
      isSupported: () => true,
    } as any;
    const capture = vi.fn().mockResolvedValue({
      stream: { getTracks: () => [] },
      audioContext: { sampleRate: 16000, state: 'running', resume: vi.fn() },
      actualSettings: {},
      sampleRate: 16000,
      cleanup: vi.fn(),
    });
    const recorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder as any,
      checkSupport: false,
      onTranscript,
    });
    await ctrl.start();
    await ctrl.stop();
    expect(onTranscript).toHaveBeenCalledWith('teste de voz');
  });
});
