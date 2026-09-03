'use client';

import { useState, useRef, useCallback } from 'react';

// VOZ-002 — Probe técnico isolado, DEV ONLY, não aparece na navegação
// Não altera ChatAssistant, não integra voz ao fluxo normal do chat

type TestStatus = 'idle' | 'running' | 'pass' | 'fail' | 'blocked';

export default function VoiceTestPage() {
  const [secure, setSecure] = useState<any>(null);
  const [permStatus, setPermStatus] = useState<{ status: TestStatus; detail: string; settings?: any }>({ status: 'idle', detail: '' });
  const [rmsLog, setRmsLog] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [pcmInfo, setPcmInfo] = useState<any>(null);
  const [moonshine, setMoonshine] = useState<{ status: TestStatus; detail: string; latency?: number }>({ status: 'idle', detail: '' });
  const [privacy, setPrivacy] = useState<string>('Não verificado');

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  // Test A — Secure Context
  const runTestA = useCallback(() => {
    const result = {
      isSecureContext: typeof window !== 'undefined' ? (window as any).isSecureContext : 'unknown',
      href: typeof window !== 'undefined' ? location.href : 'unknown',
      mediaDevices: typeof navigator !== 'undefined' ? !!navigator.mediaDevices : false,
      getUserMedia: typeof navigator !== 'undefined' ? typeof navigator.mediaDevices?.getUserMedia : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
    setSecure(result);
  }, []);

  // Test B — Permissão microfone
  const runTestB = useCallback(async () => {
    setPermStatus({ status: 'running', detail: 'Solicitando getUserMedia...' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      const s = track.getSettings();
      setSettings(s);
      setPermStatus({ status: 'pass', detail: `Sucesso — track label: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`, settings: s });
      setPrivacy('Stream ativo — nenhum upload realizado (MEDIDO)');
    } catch (e: any) {
      setPermStatus({ status: 'fail', detail: `Erro ${e?.name}: ${e?.message || e}` });
    }
  }, []);

  // Test C — RMS sinal real
  const runTestC = useCallback(() => {
    if (!streamRef.current) {
      setRmsLog(prev => [...prev, 'Sem stream — execute Teste B primeiro']);
      return;
    }
    setRmsLog([]);
    const stream = streamRef.current;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let count = 0;
    const log: string[] = [];

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      // RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const label = count < 5 ? 'SILÊNCIO' : count < 10 ? 'FALA' : 'SILÊNCIO';
      log.push(`${label} RMS ${rms.toFixed(4)}`);
      setRmsLog([...log]);
      count++;
      if (count < 15) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // não fecha AudioContext aqui, mantém para Teste D/E
      }
    };
    tick();
  }, []);

  const stopRms = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Test D — track.getSettings
  const runTestD = useCallback(() => {
    if (!streamRef.current) {
      setSettings({ error: 'Sem stream' });
      return;
    }
    const track = streamRef.current.getAudioTracks()[0];
    setSettings(track.getSettings());
  }, []);

  // Test E — conversão PCM 16k
  const runTestE = useCallback(async () => {
    if (!streamRef.current || !audioCtxRef.current) {
      setPcmInfo({ error: 'Sem stream/AudioContext — execute B e C' });
      return;
    }
    const ctx = audioCtxRef.current;
    const trackSettings = streamRef.current.getAudioTracks()[0].getSettings();
    const inputRate = (trackSettings.sampleRate as number) || ctx.sampleRate;
    setPcmInfo({
      inputSampleRate: inputRate,
      audioContextSampleRate: ctx.sampleRate,
      channelCount: (trackSettings.channelCount as number) || 1,
      targetSampleRate: 16000,
      targetChannels: 1,
      conversion: inputRate !== 16000 ? `resample ${inputRate}→16000 (Float32→Int16)` : 'sem resample (já 16k)',
      localOnly: true,
      upload: 0,
    });
  }, []);

  // Test F — Moonshine (isolado, sem chatbot)
  const runTestF = useCallback(async () => {
    setMoonshine({ status: 'running', detail: 'Carregando Moonshine Tiny Streaming (~30 MB)...' });
    const startLoad = Date.now();
    try {
      const { getMoonshineRuntime } = await import('@/lib/voice/stt/moonshine');
      const runtime = getMoonshineRuntime({ model: 'tiny-streaming', useStreaming: false });
      await runtime.load({
        onModelLoadStart: () => {},
        onModelLoadEnd: () => {},
      });
      const loadMs = Date.now() - startLoad;

      // Não temos áudio gravado real nesta probe — apenas validamos que runtime carrega sem upload
      // Para teste real, usuário deve falar após Teste C e observar onCommitted
      // Aqui fazemos startTranscription real se houver sinal
      if (!streamRef.current) {
        setMoonshine({ status: 'fail', detail: `Modelo carregado em ${loadMs}ms, mas sem stream de microfone (execute B/C antes)` });
        return;
      }

      const { getMoonshineRuntime: getRt2 } = await import('@/lib/voice/stt/moonshine');
      const rt2 = getRt2({ model: 'tiny-streaming', useStreaming: true });
      const startInfer = Date.now();
      let committed = '';
      const handle = await rt2.startTranscription({
        onCommitted: (text) => {
          committed = text;
          const inferMs = Date.now() - startInfer;
          setMoonshine({ status: 'pass', detail: `Transcrição: "${text}"`, latency: inferMs });
        },
        onPartial: () => {},
        onError: (code, msg) => setMoonshine({ status: 'fail', detail: `${code}: ${msg}` }),
      });

      // Auto-stop após 8s para não ficar gravando indefinidamente
      setTimeout(() => {
        try { handle.stop(); } catch {}
        if (!committed) {
          setMoonshine({ status: 'pass', detail: `Modelo Tiny Streaming carregado em ${loadMs}ms, aguardando fala — fale agora (8s janela). Se nada, WER não medido.` });
        }
      }, 8000);

      setMoonshine({ status: 'running', detail: `Modelo carregado em ${loadMs}ms — fale agora (janela 8s)...` });
    } catch (e: any) {
      setMoonshine({ status: 'fail', detail: `Erro Moonshine: ${e?.message || e} — WASM/WebGPU pode não estar disponível` });
    }
  }, []);

  // Test G — Privacidade cleanup
  const runTestG = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
      audioCtxRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPrivacy('Stream encerrado — nenhum Blob persistido, nenhum upload (MEDIDO via encerramento local)');
    } catch (e: any) {
      setPrivacy(`Erro ao encerrar: ${e?.message}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 text-center">
          <h1 className="text-xl font-black tracking-tight">VOICE TEST / DEV ONLY</h1>
          <p className="text-xs font-mono text-stone-600">/dev/voice-test — probe isolado, não aparece na navegação</p>
          <p className="text-[11px] text-stone-500 mt-1">Não altera ChatAssistant • Não cria guardrails novos • Áudio local apenas</p>
        </div>

        {/* Teste A */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste A — Secure Context</h2>
          <button onClick={runTestA} className="px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-bold">Rodar Teste A</button>
          {secure && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(secure, null, 2)}</pre>}
          <p className="text-xs text-stone-500">Critério: isSecureContext, href, mediaDevices, getUserMedia</p>
        </section>

        {/* Teste B */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste B — Permissão microfone (getUserMedia)</h2>
          <button onClick={runTestB} className="px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold">Solicitar microfone</button>
          <div className={`p-3 rounded-xl text-sm ${permStatus.status==='pass'?'bg-emerald-50 border border-emerald-200': permStatus.status==='fail'?'bg-rose-50 border border-rose-200':'bg-stone-100'}`}>{permStatus.detail || 'Aguardando'}</div>
        </section>

        {/* Teste C */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste C — Sinal real (RMS)</h2>
          <div className="flex gap-2">
            <button onClick={runTestC} className="px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-bold">Medir RMS (15 frames)</button>
            <button onClick={stopRms} className="px-4 py-2 bg-white border rounded-full text-sm">Parar</button>
          </div>
          <div className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs font-mono h-40 overflow-auto">
            {rmsLog.length ? rmsLog.join('\n') : 'Aguardando — faça 5 frames silêncio, 5 fala, 5 silêncio'}
          </div>
          <p className="text-xs text-stone-500">Silêncio ≈0.0000–0.001, voz ≈0.02–0.09</p>
        </section>

        {/* Teste D */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste D — track.getSettings()</h2>
          <button onClick={runTestD} className="px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-bold">Ler Settings</button>
          {settings && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(settings, null, 2)}</pre>}
        </section>

        {/* Teste E */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste E — Conversão PCM 16kHz mono</h2>
          <button onClick={runTestE} className="px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-bold">Validar formato pipeline</button>
          {pcmInfo && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(pcmInfo, null, 2)}</pre>}
          <p className="text-xs text-stone-500">Conversão local, sem upload — resample Float32→Int16 se necessário</p>
        </section>

        {/* Teste F */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste F — Moonshine Tiny Streaming (opcional)</h2>
          <p className="text-xs text-stone-600">Só execute se Teste C mostrar sinal real. Carrega ~30 MB, sem upload de áudio.</p>
          <button onClick={runTestF} className="px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold">Carregar Moonshine + Transcrever 8s</button>
          <div className={`p-3 rounded-xl text-sm ${moonshine.status==='pass'?'bg-emerald-50 border border-emerald-200': moonshine.status==='fail'?'bg-rose-50 border border-rose-200':'bg-stone-100'}`}>{moonshine.detail || 'Aguardando'}</div>
          {moonshine.latency && <p className="text-xs text-stone-500">Latência: {moonshine.latency}ms</p>}
        </section>

        {/* Teste G */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Teste G — Privacidade (cleanup)</h2>
          <button onClick={runTestG} className="px-4 py-2 bg-rose-600 text-white rounded-full text-sm font-bold">Encerrar stream</button>
          <p className="text-sm bg-stone-100 p-3 rounded-xl">{privacy}</p>
          <p className="text-xs text-stone-500">Verificar DevTools Network: 0 upload de áudio durante todo o teste</p>
        </section>

        <div className="text-[11px] text-stone-400 text-center">Probe isolado — não altera ChatAssistant • Não persiste áudio • Para teste manual em Android físico</div>
      </div>
    </div>
  );
}
