import "server-only";

import { Worker as NodeWorker } from "node:worker_threads";
import sharp from "sharp";

// libraw-wasm uses the browser Worker API. This adapter runs its packaged worker
// in a Node worker and loads the adjacent WASM file from the package on disk.
class NodeWebWorker {
  private worker: NodeWorker;
  onmessage?: (event: { data: unknown }) => void;

  constructor(url: URL) {
    this.worker = new NodeWorker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const { readFile } = require('node:fs/promises');
      const { fileURLToPath } = require('node:url');
      globalThis.self = globalThis;
      globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (url, options) => String(url).startsWith('file:')
        ? readFile(fileURLToPath(url)).then(data => new Response(data, { headers: { 'Content-Type': 'application/wasm' } }))
        : originalFetch(url, options);
      const queue = [];
      parentPort.on('message', data => {
        if (globalThis.onmessage) globalThis.onmessage({ data });
        else queue.push(data);
      });
      import(workerData.url).then(() => {
        for (const data of queue) globalThis.onmessage({ data });
      });
    `, { eval: true, workerData: { url: url.href } });
    this.worker.on("message", data => this.onmessage?.({ data }));
  }

  postMessage(data: unknown, transfer?: readonly ArrayBuffer[]) { this.worker.postMessage(data, transfer as ArrayBuffer[] | undefined); }
  terminate() { return this.worker.terminate(); }
}

export async function decodeCameraRaw(original: Buffer): Promise<Buffer> {
  (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = NodeWebWorker as unknown as typeof Worker;
  const LibRaw = (await import("libraw-wasm")).default;
  const raw = new LibRaw();
  try {
    await raw.open(new Uint8Array(original), { outputBps: 8, outputColor: 1, useCameraWb: true });
    const decoded = await raw.imageData();
    if (!decoded || !(decoded.data instanceof Uint8Array) || decoded.colors < 3 || decoded.colors > 4)
      throw new Error("This RAW variant could not be decoded.");
    return await sharp(Buffer.from(decoded.data), { raw: {
      width: decoded.width, height: decoded.height, channels: decoded.colors as 3 | 4,
    } }).jpeg({ quality: 95 }).toBuffer();
  } finally {
    raw.dispose();
  }
}
