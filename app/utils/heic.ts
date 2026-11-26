import type { HeicRequest, HeicResponse } from "~/workers/heic.worker";

/**
 * HEIC/HEIF (iPhone photos) only open natively in Safari, so other browsers
 * convert them in a Web Worker. Browsers often report HEIC files with an
 * empty MIME type, so the extension is checked too.
 */
export function isHeic(name: string, type: string) {
  return (
    /^image\/hei[cf](-sequence)?$/i.test(type) || /\.(heic|heif)$/i.test(name)
  );
}

let worker: Worker | null = null;
let nextJob = 0;

const pending = new Map<
  number,
  { resolve: (blob: Blob) => void; reject: (error: Error) => void }
>();

function getWorker() {
  if (worker) {
    return worker;
  }

  // Loaded on first use, so the ~2 MB decoder is only fetched when needed.
  worker = new Worker(new URL("../workers/heic.worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = ({ data }: MessageEvent<HeicResponse>) => {
    const job = pending.get(data.id);

    pending.delete(data.id);

    if ("blob" in data) {
      job?.resolve(data.blob);
    } else {
      job?.reject(new Error(data.error));
    }
  };

  worker.onerror = (event) => {
    // The worker itself crashed (e.g. out of memory): fail everything queued.
    for (const job of pending.values()) {
      job.reject(new Error(event.message || "HEIC converter crashed"));
    }

    pending.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
}

/** Converts a HEIC/HEIF file to a JPEG file, keeping its base name. */
export async function convertHeic(file: File) {
  const buffer = await file.arrayBuffer();
  const blob = await new Promise<Blob>((resolve, reject) => {
    const id = nextJob++;
    const request: HeicRequest = { buffer, id };

    pending.set(id, { reject, resolve });
    getWorker().postMessage(request, [buffer]);
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
    lastModified: file.lastModified,
    type: "image/jpeg",
  });
}
