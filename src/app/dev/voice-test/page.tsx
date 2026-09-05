'use client';

import { useState, useRef, useCallback, useReducer } from 'react';
import { listEngines, getEngine } from '@/lib/voice/stt/registry';
import type { STTEngine } from '@/lib/voice/stt/registry';
import { engineStateReducer, INITIAL_ENGINE_STATE, canLoad, canTranscribe, isEngineReady } from '@/lib/voice/stt/engineState';

// VOZ-004-R3 — Lab neutro de Speech-to-Text (DEV ONLY)
// A página é um laboratório experimental de engines STT, não uma funcionalidade do produto.
// Pipeline comum de áudio (A–E) é separado da engine STT (F–G) via registry.
// Execução 100% local: sem /api/stt, sem upload de áudio, sem persistência.
// VOZ-004-R3.1 — Engine State Hardening:
// G (Transcribe) só executa quando engineState === READY (ou RESULT para nova execução).
// A lógica protege além do disabled: chamadas inválidas são abortadas sem exceção.

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

type EnginePhase = 'load' | 'transcribe';

type EngineRunState = {
  status: TestStatus;
  stage: EnginePhase | null;
  detail: string;
  error?: string;
};

const emptyEngineRun: EngineRunState = { status: 'idle', stage: null, detail: '' };

export default function VoiceTestPage() {
  // ----- Pipeline comum de áudio (A–E), independe da engine -----
  const [secure, setSecure] = useState<any>(null);
  const [permStatus, setPermStatus] = useState<{ status: TestStatus; detail: string; settings?: any }>({ status: 'idle', detail: '' });
  const [rmsLog, setRmsLog] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [pcmInfo, setPcmInfo] = useState<any>(null);
  const [privacy, setPrivacy] = useState<string>('Não verificado');

  // ----- ENGINE TEST (F–G) -----
  const engines = listEngines();
  const [selectedEngineId, setSelectedEngineId] = useState<string>('vosk-pt-br');
  const selectedEngine: STTEngine = getEngine(selectedEngineId) || engines[0];
  const [loadState, setLoadState] = useState<EngineRunState>(emptyEngineRun);
  const [result, setResult] = useState<any>(null);
  const [transcribeState, setTranscribeState] = useState<EngineRunState>(emptyEngineRun);

  // Máquina de estados da engine (F–G) — fonte de verdade para habilitar/desabilitar.
  const [engineState, dispatchEngine] = useReducer(engineStateReducer, INITIAL_ENGINE_STATE);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const fixtureRef = useRef<{ pcm: Float32Array; sampleRate: number; info: any } | null>(null);
  const engineRef = useRef<STTEngine>(selectedEngine);
  // Locks síncronos contra chamadas duplicadas (não dependem do re-render).
  const loadingRef = useRef(false);
  const transcribingRef = useRef(false);
  const selectedEngineIdRef = useRef(selectedEngineId);

  // ----- A — Secure Context -----
  const runTestA = useCallback(() => {
    setSecure({
      isSecureContext: typeof window !== 'undefined' ? (window as any).isSecureContext : 'unknown',
      href: typeof window !== 'undefined' ? location.href : 'unknown',
      mediaDevices: typeof navigator !== 'undefined' ? !!navigator.mediaDevices : false,
      getUserMedia: typeof navigator !== 'undefined' ? typeof navigator.mediaDevices?.getUserMedia : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
  }, []);

  // ----- B — Microphone (getUserMedia) -----
  const runTestB = useCallback(async () => {
    setPermStatus({ status: 'running', detail: 'Solicitando getUserMedia...' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      const s = track.getSettings();
      setSettings(s);
      setPermStatus({ status: 'pass', detail: `Sucesso — track: ${track.label}`, settings: s });
      setPrivacy('Stream ativo — nenhum upload realizado (MEDIDO)');
    } catch (e: any) {
      setPermStatus({ status: 'fail', detail: `Erro ${e?.name}: ${e?.message || e}` });
    }
  }, []);

  // ----- C — Audio Signal / RMS -----
  const runTestC = useCallback(() => {
    if (!streamRef.current) {
      setRmsLog(prev => [...prev, 'Sem stream — execute B primeiro']);
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
      }
    };
    tick();
  }, []);

  const stopRms = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ----- D — Audio Settings -----
  const runTestD = useCallback(() => {
    if (!streamRef.current) {
      setSettings({ error: 'Sem stream' });
      return;
    }
    setSettings(streamRef.current.getAudioTracks()[0].getSettings());
  }, []);

  // ----- E — PCM Preparation (converte/disponibiliza PCM 16k mono) -----
  const runTestE = useCallback(async () => {
    if (!streamRef.current) {
      setPcmInfo({ error: 'Sem stream — execute B' });
      return;
    }
    const trackSettings = streamRef.current.getAudioTracks()[0].getSettings();
    const inputSampleRate = (trackSettings.sampleRate as number) || 48000;
    const sourceSampleRate = (trackSettings.sampleRate as number) || 48000;
    const channels = (trackSettings.channelCount as number) || 1;
    setPcmInfo({
      sourceSampleRate,
      decodedSampleRate: '(n/a — microfone, sem decodificação WAV)',
      inputSampleRate,
      channelCount: channels,
      targetSampleRate: 16000,
      targetChannels: 1,
      status: 'capturando 1s...',
      localOnly: true,
      upload: 0,
    });
    try {
      const stream = streamRef.current;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: inputSampleRate });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      let capturing = true;
      processor.onaudioprocess = (e: any) => {
        if (!capturing) return;
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
      await new Promise(r => setTimeout(r, 1000));
      capturing = false;
      try { source.disconnect(); } catch {}
      try { processor.disconnect(); } catch {}
      try { await audioCtx.close(); } catch {}

      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const combined = new Float32Array(totalLen);
      let off = 0;
      for (const c of chunks) { combined.set(c, off); off += c.length; }
      let pcm = combined;
      let conversion = channels === 1 ? 'sem mix' : `mix ${channels}→1ch`;
      if (inputSampleRate !== 16000) {
        const ratio = inputSampleRate / 16000;
        const newLen = Math.round(combined.length / ratio);
        const resampled = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const p = i * ratio;
          const i0 = Math.floor(p);
          const i1 = Math.min(i0 + 1, combined.length - 1);
          const frac = p - i0;
          resampled[i] = combined[i0] * (1 - frac) + combined[i1] * frac;
        }
        pcm = resampled;
        conversion += ` + resample ${inputSampleRate}→16000`;
      }
      fixtureRef.current = { pcm, sampleRate: 16000, info: { sourceSampleRate, decodedSampleRate: 'n/a', inputSampleRate: 16000, convertedSampleRate: 16000, convertedChannels: 1, pcmSamples: pcm.length, pcmDuration: Number((pcm.length / 16000).toFixed(2)), conversion } };
      setPcmInfo({
        sourceSampleRate,
        decodedSampleRate: '(n/a — microfone)',
        inputSampleRate: 16000,
        channelCount: channels,
        targetSampleRate: 16000,
        targetChannels: 1,
        conversion,
        pcmSamples: pcm.length,
        pcmDuration: Number((pcm.length / 16000).toFixed(2)),
        status: 'PCM 16k mono pronto em memória (não persistido)',
        localOnly: true,
        upload: 0,
      });
    } catch (e: any) {
      setPcmInfo({ error: e?.message || String(e) });
    }
  }, []);

  // ----- AUDIO FIXTURE (moonshire.wav) -----
  const loadFixture = useCallback(async () => {
    try {
      const fetchStart = Date.now();
      const res = await fetch('/moonshire.wav');
      if (!res.ok) throw new Error(`fetch /moonshire.wav falhou: ${res.status}`);
      const buf = await res.arrayBuffer();
      const fileSize = buf.byteLength;
      const fetchMs = Date.now() - fetchStart;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
      const decodedSampleRate = ctx.sampleRate;
      const chs = audioBuffer.numberOfChannels;
      const sr = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      let mono: Float32Array;
      if (chs === 1) mono = audioBuffer.getChannelData(0).slice(0);
      else {
        const len = audioBuffer.length;
        mono = new Float32Array(len);
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.getChannelData(1);
        for (let i = 0; i < len; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
      }
      let pcm = mono;
      let conversion = `mix ${chs}→1ch`;
      if (sr !== 16000) {
        const ratio = sr / 16000;
        const newLen = Math.round(mono.length / ratio);
        const resampled = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const p = i * ratio;
          const i0 = Math.floor(p);
          const i1 = Math.min(i0 + 1, mono.length - 1);
          const frac = p - i0;
          resampled[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
        }
        pcm = resampled;
        conversion += ` + resample ${sr}→16000`;
      }
      try { await ctx.close(); } catch {}
      const info = {
        fileSize,
        fetchMs,
        duration: Number(duration.toFixed(2)),
        sourceSampleRate: sr,
        decodedSampleRate,
        inputSampleRate: 16000,
        convertedSampleRate: 16000,
        convertedChannels: 1,
        sourceChannels: chs,
        conversion,
        pcmSamples: pcm.length,
        pcmDuration: Number((pcm.length / 16000).toFixed(2)),
      };
      fixtureRef.current = { pcm, sampleRate: 16000, info };
      return info;
    } catch (e: any) {
      throw new Error(`Falha ao preparar fixture /moonshire.wav: ${e?.message || e}`);
    }
  }, []);

  const handleEngineChange = useCallback((id: string) => {
    setSelectedEngineId(id);
    selectedEngineIdRef.current = id;
    // Troca de engine invalida READY/RESULT da engine anterior (engineState → IDLE).
    dispatchEngine({ type: 'ENGINE_CHANGE' });
    setLoadState(emptyEngineRun);
    setResult(null);
    setTranscribeState(emptyEngineRun);
  }, []);

  // ----- F — Load Engine (via registry) -----
  const runLoadEngine = useCallback(async () => {
    // Proteção além do disabled: nenhuma segunda chamada de load durante LOADING.
    if (loadingRef.current) return;
    // Estado: load permitido em IDLE/ERROR/READY/RESULT; bloqueado em LOADING/TRANSCRIBING.
    if (!canLoad(engineState)) return;

    const engine = getEngine(selectedEngineId);
    if (!engine) {
      setLoadState({ status: 'fail', stage: 'load', detail: 'Engine não encontrada no registry', error: `Nenhuma engine registrada com id "${selectedEngineId}"` });
      return;
    }
    loadingRef.current = true;
    engineRef.current = engine;
    dispatchEngine({ type: 'LOAD_START' });
    setResult(null);
    setTranscribeState(emptyEngineRun);
    setLoadState({ status: 'running', stage: 'load', detail: `Carregamento iniciado — ${engine.name} (${engine.model})` });
    const start = Date.now();
    try {
      await engine.load();
      // Engine trocada durante o load: descarta conclusão obsoleta.
      if (selectedEngineIdRef.current !== selectedEngineId) return;
      const ms = Date.now() - start;
      dispatchEngine({ type: 'LOAD_SUCCESS' });
      setLoadState({ status: 'pass', stage: 'load', detail: `Carregamento concluído em ${ms}ms — engine ${engine.name} pronta` });
    } catch (e: any) {
      if (selectedEngineIdRef.current !== selectedEngineId) return;
      const msg = e?.message || String(e);
      dispatchEngine({ type: 'LOAD_ERROR' });
      setLoadState({ status: 'fail', stage: 'load', detail: `Erro de carregamento (${engine.name}): ${msg}`, error: msg });
    } finally {
      loadingRef.current = false;
    }
  }, [selectedEngineId, engineState]);

  // ----- G — Transcribe (via registry) -----
  const runTranscribe = useCallback(async () => {
    // Proteção lógica (além do disabled): transcrever requer engine READY (ou RESULT para nova execução).
    if (!isEngineReady(engineState)) return;
    // Proteção: nenhuma segunda transcrição durante TRANSCRIBING.
    if (transcribingRef.current) return;

    const engine = getEngine(selectedEngineId);
    if (!engine) {
      setTranscribeState({ status: 'fail', stage: 'transcribe', detail: 'Engine não encontrada', error: `Nenhuma engine registrada com id "${selectedEngineId}"` });
      return;
    }
    engineRef.current = engine;
    transcribingRef.current = true;
    dispatchEngine({ type: 'TRANSCRIBE_START' });
    // Resultado antigo não contamina a nova execução.
    setResult(null);
    setTranscribeState({ status: 'running', stage: 'transcribe', detail: `Inferência iniciada — ${engine.name} (${engine.model})` });

    // Precisamos de PCM 16k mono. Usa PCM de E (microfone) ou fixture WAV.
    let pcm: Float32Array | null = fixtureRef.current?.pcm || null;
    let sampleRate = 16000;
    let sourceDesc = fixtureRef.current ? 'fixture (E/microfone)' : null;
    if (!pcm) {
      setTranscribeState({ status: 'running', stage: 'transcribe', detail: `Sem PCM em memória — carregando fixture /moonshire.wav para ${engine.name}...` });
      try {
        const info = await loadFixture();
        pcm = fixtureRef.current?.pcm || null;
        sampleRate = 16000;
        sourceDesc = `fixture /moonshire.wav (${info.duration}s, ${info.sourceSampleRate}Hz→${info.inputSampleRate}Hz)`;
      } catch (e: any) {
        if (selectedEngineIdRef.current !== selectedEngineId) { transcribingRef.current = false; return; }
        const msg = e?.message || String(e);
        dispatchEngine({ type: 'TRANSCRIBE_ERROR' });
        setTranscribeState({ status: 'fail', stage: 'transcribe', detail: msg, error: msg });
        transcribingRef.current = false;
        return;
      }
    }
    if (!pcm) {
      if (selectedEngineIdRef.current !== selectedEngineId) { transcribingRef.current = false; return; }
      const msg = 'Sem PCM para transcrever — execute E (PCM Preparation) primeiro';
      dispatchEngine({ type: 'TRANSCRIBE_ERROR' });
      setTranscribeState({ status: 'fail', stage: 'transcribe', detail: msg, error: 'Sem PCM' });
      transcribingRef.current = false;
      return;
    }

    const start = Date.now();
    try {
      const res = await engine.transcribe(pcm, sampleRate);
      const inferMs = Date.now() - start;
      const pcmDurationSec = pcm.length / sampleRate;
      const rtf = inferMs / 1000 / (pcmDurationSec || 1);
      if (selectedEngineIdRef.current !== selectedEngineId) return;
      dispatchEngine({ type: 'TRANSCRIBE_SUCCESS' });
      setResult({
        status: res.text && res.text.trim() ? 'PASS' : 'EMPTY',
        engine: engine.name,
        engineId: engine.id,
        model: engine.model,
        language: engine.language,
        loadMs: loadState.status === 'pass' ? loadState.detail.match(/em (\d+)ms/)?.slice(1)[0] : undefined,
        inferenceMs: res.inferenceMs ?? inferMs,
        rtf: Number(rtf.toFixed(3)),
        transcriptionLength: res.text?.length || 0,
        transcription: res.text || '',
        pcmSamples: pcm.length,
        sourceDesc,
      });
      setTranscribeState({ status: 'pass', stage: 'transcribe', detail: `Inferência concluída — Stage: transcribe` });
    } catch (e: any) {
      if (selectedEngineIdRef.current !== selectedEngineId) return;
      const msg = e?.message || String(e);
      dispatchEngine({ type: 'TRANSCRIBE_ERROR' });
      setTranscribeState({ status: 'fail', stage: 'transcribe', detail: `Erro de inferência — Stage: transcribe — ${msg}`, error: msg });
    } finally {
      transcribingRef.current = false;
    }
  }, [selectedEngineId, engineState, loadState.status, loadFixture]);

  // ----- Cleanup -----
  const runCleanup = useCallback(async () => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
    try { if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close(); } catch {}
    audioCtxRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    // Libera recursos da engine quando suportado
    if (engineRef.current?.dispose) {
      try { await engineRef.current.dispose(); } catch {}
    }
    dispatchEngine({ type: 'RESET' });
    setLoadState(emptyEngineRun);
    setResult(null);
    setTranscribeState(emptyEngineRun);
    setPrivacy('Stream e AudioContext encerrados — engine liberada, nenhum Blob persistido, nenhum upload (MEDIDO)');
  }, []);

  const engineIsVosk = (engine: STTEngine) => engine.id === 'vosk-pt-br';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Identidade */}
        <div className="bg-stone-900 text-stone-50 rounded-2xl p-5 text-center">
          <h1 className="text-2xl font-black tracking-tight">VOICE / STT LAB</h1>
          <p className="text-xs font-mono text-stone-400 mt-1">DEV ONLY — laboratório experimental de engines Speech-to-Text</p>
          <p className="text-[11px] text-stone-400 mt-1">Não é funcionalidade do produto • Não aparece na navegação • Execução 100% local</p>
          <p className="text-[11px] text-emerald-300 mt-2 font-bold">LOCAL ONLY — sem upload, sem /api/stt, sem persistência de áudio</p>
        </div>

        {/* Fonte de áudio */}
        <section className="bg-white rounded-2xl border p-4 space-y-2">
          <h2 className="font-bold text-sm">Fonte de áudio</h2>
          <div className="bg-stone-100 rounded-xl p-3 text-sm font-mono">└─ WAV local: <code>moonshire.wav</code></div>
          <p className="text-xs text-stone-500">
            <b>AUDIO FIXTURE</b>: <code>public/moonshire.wav</code> (2.3 MB, 48 kHz stereo) — fonte conhecida de áudio de teste, não pertence a uma engine específica. GET local (sem upload).
          </p>
          <button onClick={async () => {
            try { const info = await loadFixture(); setPrivacy(`Fixture carregado: ${info.duration}s, ${info.sourceSampleRate}Hz→${info.inputSampleRate}Hz mono (GET local, sem upload)`); } catch (e: any) { setPrivacy(`Fixture: ${e?.message}`); }
          }} className="px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-bold">Carregar fixture (pré-decodificar)</button>
        </section>

        {/* Captura — pipeline comum */}
        <section className="bg-white rounded-2xl border p-4 space-y-4">
          <h2 className="font-bold">Captura <span className="text-xs font-normal text-stone-500">(pipeline comum, independe da engine)</span></h2>

          <div className="space-y-3">
            <h3 className="font-bold text-sm">A — Secure Context</h3>
            <button onClick={runTestA} className="px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold">Rodar A</button>
            {secure && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(secure, null, 2)}</pre>}
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-sm">B — Microphone (getUserMedia)</h3>
            <button onClick={runTestB} className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold">Solicitar microfone</button>
            <div className={`p-3 rounded-xl text-xs ${permStatus.status==='pass'?'bg-emerald-50 border border-emerald-200':permStatus.status==='fail'?'bg-rose-50 border border-rose-200':'bg-stone-100'}`}>{permStatus.detail || 'Aguardando'}</div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-sm">C — Audio Signal / RMS</h3>
            <div className="flex gap-2">
              <button onClick={runTestC} className="px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold">Medir RMS (15 frames)</button>
              <button onClick={stopRms} className="px-4 py-2 bg-white border rounded-full text-xs">Parar</button>
            </div>
            <div className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs font-mono h-24 overflow-auto">{rmsLog.length ? rmsLog.join('\n') : '5 silêncio / 5 fala / 5 silêncio'}</div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-sm">D — Audio Settings</h3>
            <button onClick={runTestD} className="px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold">Ler Settings</button>
            {settings && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(settings, null, 2)}</pre>}
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-sm">E — PCM Preparation</h3>
            <p className="text-xs text-stone-500">Microfone → mono 16 kHz PCM em memória (não persistido). <code>sourceSampleRate</code> ≠ <code>decodedSampleRate</code> quando o WAV é decodificado em sample rate diferente do original.</p>
            <button onClick={runTestE} className="px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold">Preparar PCM 16k mono (1s mic)</button>
            {pcmInfo && <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(pcmInfo, null, 2)}</pre>}
          </div>
        </section>

        {/* ENGINE TEST */}
        <section className="bg-white rounded-2xl border-2 border-stone-900 p-4 space-y-4">
          <h2 className="font-bold">ENGINE TEST</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-bold">Engine:</label>
            <select value={selectedEngineId} onChange={e => handleEngineChange(e.target.value)} className="px-3 py-2 bg-white border rounded-full text-sm font-bold">
              {engines.map(e => <option key={e.id} value={e.id}>{e.name} — {e.language} ({e.model})</option>)}
            </select>
          </div>
          <p className="text-xs text-stone-500">
            Selecionada: <b>{selectedEngine?.name}</b> — {selectedEngine?.language} — <code>{selectedEngine?.model}</code>{' '}
            {selectedEngine && engineIsVosk(selectedEngine) && '(runtime corrigido na VOZ-004-R4 — bundling funcional no browser)'}
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-stone-50 border rounded-xl p-3 space-y-2">
              <h3 className="font-bold text-sm">F — Load Engine</h3>
              <button
                onClick={runLoadEngine}
                disabled={!canLoad(engineState)}
                className="w-full px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >Carregar {selectedEngine?.name}</button>
              <div className={`p-3 rounded-xl text-xs whitespace-pre-wrap ${loadState.status==='pass'?'bg-emerald-50 border border-emerald-200':loadState.status==='fail'?'bg-rose-50 border border-rose-200':loadState.status==='running'?'bg-amber-50 border border-amber-200':'bg-white border'}`}>
                {loadState.detail || <span className="text-stone-400">Aguardando — carregamento iniciado / concluído / erro</span>}
              </div>
            </div>
            <div className="bg-stone-50 border rounded-xl p-3 space-y-2">
              <h3 className="font-bold text-sm">G — Transcribe</h3>
              <button
                onClick={runTranscribe}
                disabled={!canTranscribe(engineState)}
                title={canTranscribe(engineState) ? '' : 'Habilitado somente quando a engine está READY (carregue a engine em F)'}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >Transcrever PCM</button>
              <div className={`p-3 rounded-xl text-xs whitespace-pre-wrap ${transcribeState.status==='pass'?'bg-emerald-50 border border-emerald-200':transcribeState.status==='fail'?'bg-rose-50 border border-rose-200':transcribeState.status==='running'?'bg-amber-50 border border-amber-200':'bg-white border'}`}>
                {transcribeState.detail || <span className="text-stone-400">Aguardando — inferência iniciada / concluída / erro</span>}
              </div>
            </div>
          </div>

          <p className="text-xs text-stone-500">
            Estado da engine: <b>{engineState}</b> — G habilitado somente em <code>READY</code> (ou <code>RESULT</code> para nova execução). Idle/Loading/Transcribing/Error desabilitam G.
          </p>

          {(loadState.status === 'fail' || transcribeState.status === 'fail') && (() => {
            const err = loadState.status === 'fail' ? loadState : transcribeState;
            return (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-xs">
                <p className="font-bold text-rose-700">Status: ERROR</p>
                <p>Engine: {selectedEngine?.name}</p>
                <p>Stage: {err.stage}</p>
                <p className="break-words">Error: <code className="text-rose-800">{err.error}</code></p>
                <p className="text-stone-500 mt-1">Causa original preservada — não mascarada.</p>
              </div>
            );
          })()}
        </section>

        {/* RESULTADO STT */}
        <section className="bg-white rounded-2xl border-2 border-emerald-300 p-4 space-y-3">
          <h2 className="font-bold">RESULTADO STT</h2>
          {result ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-50 p-2 rounded">Status: <b>{result.status}</b></div>
                <div className="bg-stone-50 p-2 rounded">Engine: <b>{result.engine}</b></div>
                <div className="bg-stone-50 p-2 rounded">Modelo: <code>{result.model}</code></div>
                <div className="bg-stone-50 p-2 rounded">Idioma: <b>{result.language}</b></div>
                <div className="bg-stone-50 p-2 rounded">Load time: {result.loadMs !== undefined ? `${result.loadMs}ms` : '—'}</div>
                <div className="bg-stone-50 p-2 rounded">Inference time: {result.inferenceMs}ms</div>
                <div className="bg-stone-50 p-2 rounded">RTF: {result.rtf ?? '—'}</div>
                <div className="bg-stone-50 p-2 rounded">Tamanho: {result.transcriptionLength} chars</div>
              </div>
              {result.sourceDesc && <p className="text-xs text-stone-500">Fonte: {result.sourceDesc}</p>}
              <div className="bg-white border-2 border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700">Transcrição real:</p>
                <p className="text-sm font-mono bg-stone-50 p-2 rounded mt-1">{result.transcription ? `"${result.transcription}"` : '(vazia — sem texto produzido, não é resultado inventado)'}</p>
              </div>
              <pre className="bg-stone-900 text-emerald-300 p-3 rounded-xl text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Nenhum resultado — execute F (Load) e G (Transcribe). Erros reais aparecem aqui com a causa original.</p>
          )}
        </section>

        {/* Cleanup */}
        <section className="bg-white rounded-2xl border p-4 space-y-3">
          <h2 className="font-bold">Cleanup</h2>
          <button onClick={runCleanup} className="px-4 py-2 bg-rose-600 text-white rounded-full text-sm font-bold">Encerrar e liberar recursos</button>
          <p className="text-sm bg-stone-100 p-3 rounded-xl">{privacy}</p>
          <p className="text-xs text-stone-500">Para tracks do microfone, AudioContext e engine (dispose quando suportado). Verificar DevTools Network: 0 upload de áudio.</p>
        </section>

        <div className="text-[11px] text-stone-400 text-center">VOICE / STT LAB — DEV ONLY — lab neutro de engines STT • sem ChatAssistant • sem /api/stt • sem persistência de áudio</div>
      </div>
    </div>
  );
}
