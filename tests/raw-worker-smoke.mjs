import { Worker as NodeWorker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
class WorkerAdapter {
  constructor(url) {
    this.worker = new NodeWorker(`
      const { parentPort, workerData } = require('node:worker_threads');
      globalThis.self = globalThis;
      const { readFile } = require('node:fs/promises');
      const { fileURLToPath } = require('node:url');
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => String(url).startsWith('file:') ? new Response(await readFile(fileURLToPath(url)), { headers: { 'Content-Type': 'application/wasm' } }) : originalFetch(url, options);
      globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
      const queue = [];
      parentPort.on('message', data => {
        if (globalThis.onmessage) globalThis.onmessage({ data });
        else queue.push(data);
      });
      import(workerData.url).then(() => {
        for (const data of queue) globalThis.onmessage({ data });
      });
    `, { eval: true, workerData: { url: url.href } });
    this.worker.on('message', data => this.onmessage?.({ data }));
    this.worker.on('error', error => console.error('worker error', error));
  }
  postMessage(data, transfer) { this.worker.postMessage(data, transfer); }
  terminate() { return this.worker.terminate(); }
}
globalThis.Worker = WorkerAdapter;
const { default: LibRaw } = await import('libraw-wasm');
const raw = new LibRaw();
try {
  const bytes = process.argv[2] ? await readFile(process.argv[2]) : Buffer.from([1, 2, 3]);
  await raw.open(new Uint8Array(bytes), { outputBps: 8, outputColor: 1, useCameraWb: true });
  const image = await raw.imageData();
  if (process.argv[2]) {
    if (!image?.data?.length) throw new Error('RAW did not decode');
    const jpeg = await sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: image.colors } }).jpeg({ quality: 95 }).toBuffer();
    const metadata = await sharp(jpeg).metadata();
    if (metadata.width !== image.width || metadata.height !== image.height) throw new Error('JPEG dimensions changed unexpectedly');
    console.log(JSON.stringify({ width: image.width, height: image.height, colors: image.colors, bits: image.bits, bytes: image.data.length, jpegBytes: jpeg.length }));
  } else if (image) { console.error('Invalid RAW accepted'); process.exitCode = 1; }
  else console.log('Invalid RAW returned no image');
} catch (error) {
  console.error('RAW decode failed:', error.message);
  process.exitCode = 1;
}
raw.dispose();
