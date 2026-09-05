const fs = require('fs');
const path = require('path');

function writeWav(filePath, sampleRate, durationSec, freq) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSec);
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // PCM data - sine wave 440Hz
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.5;
    const int16 = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
    buffer.writeInt16LE(int16, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
  console.log(`Wrote ${filePath} ${durationSec}s ${sampleRate}Hz`);
}

const outDir = path.join(__dirname, '..', 'public', 'voice-benchmark');
const samples = [
  { id: 'PTBR-01', duration: 5, freq: 440, text: 'A fé é a certeza das coisas que se esperam.' },
  { id: 'PTBR-02', duration: 8, freq: 440, text: 'Quero trocar arroz por batata doce' },
  { id: 'PTBR-03', duration: 7, freq: 440, text: 'Posso comer leites vegetais?' },
  { id: 'PTBR-04', duration: 6, freq: 440, text: 'Meu peso é setenta quilos' },
  { id: 'PTBR-05', duration: 6, freq: 440, text: 'Não posso comer açúcar' },
  { id: 'PTBR-06', duration: 9, freq: 440, text: 'Tô comendo muito pão, sabe?' },
];

samples.forEach(s => {
  writeWav(path.join(outDir, `${s.id}.wav`), 16000, s.duration, s.freq);
});

console.log('done');
