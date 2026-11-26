// Minimal types for the parts of libheif-js' JS wrapper this app uses.
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    /** Decodes into `target.data` (RGBA). Calls back with null on failure. */
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      callback: (result: unknown | null) => void,
    ): void;
    free(): void;
  }

  interface HeifDecoder {
    decode(buffer: Uint8Array): HeifImage[];
    decoder: { delete(): void };
  }

  interface Libheif {
    ready: Promise<void>;
    HeifDecoder: new () => HeifDecoder;
  }

  export default function createLibheif(): Libheif;
}
