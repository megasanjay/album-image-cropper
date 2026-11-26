// Decodes HEIC/HEIF files off the main thread and re-encodes them as JPEG,
// which every browser can display. Runs entirely in the browser.
import createLibheif from "libheif-js/libheif-wasm/libheif-bundle.mjs";

export interface HeicRequest {
  id: number;
  buffer: ArrayBuffer;
}

export type HeicResponse =
  { id: number; blob: Blob } | { id: number; error: string };

const libheif = createLibheif();

// The app's tsconfig uses DOM types, not WebWorker ones.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HeicRequest>) => void) | null;
  postMessage(message: HeicResponse): void;
};

async function toJpeg(buffer: ArrayBuffer) {
  await libheif.ready;

  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buffer));

  try {
    const image = images[0];

    if (!image) {
      throw new Error("No image found in file");
    }

    const width = image.get_width();
    const height = image.get_height();
    const pixels = new ImageData(width, height);

    // libheif applies the file's rotation/mirroring while decoding.
    await new Promise<void>((resolve, reject) => {
      image.display(pixels, (result) =>
        result ? resolve() : reject(new Error("Could not decode HEIC image")),
      );
    });

    const canvas = new OffscreenCanvas(width, height);

    canvas.getContext("2d")!.putImageData(pixels, 0, 0);

    // High quality so the later crop re-encode loses as little as possible.
    return await canvas.convertToBlob({ quality: 0.98, type: "image/jpeg" });
  } finally {
    for (const image of images) {
      image.free();
    }

    decoder.decoder.delete();
  }
}

scope.onmessage = async ({ data: { buffer, id } }) => {
  try {
    scope.postMessage({ blob: await toJpeg(buffer), id });
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    });
  }
};
