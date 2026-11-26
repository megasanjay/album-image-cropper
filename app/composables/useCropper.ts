export interface CropImage {
  id: string;
  file: File;
  url: string;
  /** Size of the image as displayed (after EXIF orientation, before rotation). */
  naturalWidth: number;
  naturalHeight: number;
  rotation: Rotation;
  crop: CropRect;
  /** The user has adjusted this crop by hand. */
  edited: boolean;
  /** HEIC converted to JPEG in the browser so it can be displayed. */
  converted: boolean;
  /** Name of the file as it was picked, before any conversion. */
  originalName: string;
  /** Still being read or converted. */
  loading: boolean;
  error: boolean;
}

export type Orientation = "auto" | "landscape" | "portrait";

export interface AspectPreset {
  label: string;
  value: string;
  /** Long side / short side. `null` = free, `0` = the image's own ratio. */
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: "Free", ratio: null, value: "free" },
  { label: "Original", ratio: 0, value: "original" },
  { label: "Square", ratio: 1, value: "1:1" },
  { label: "3:2", ratio: 3 / 2, value: "3:2" },
  { label: "4:3", ratio: 4 / 3, value: "4:3" },
  { label: "5:4", ratio: 5 / 4, value: "5:4" },
  { label: "7:5", ratio: 7 / 5, value: "7:5" },
  { label: "16:9", ratio: 16 / 9, value: "16:9" },
];

/** Width and height of the image after its rotation is applied. */
export function rotatedSize(image: CropImage) {
  const quarterTurn = image.rotation === 90 || image.rotation === 270;

  return quarterTurn
    ? { height: image.naturalWidth, width: image.naturalHeight }
    : { height: image.naturalHeight, width: image.naturalWidth };
}

// Client-only app (ssr: false), so module-level state is safe to share.
const images = ref<CropImage[]>([]);
const currentId = ref<string | null>(null);
const aspect = ref("original");
const orientation = ref<Orientation>("auto");
const exporting = ref(false);
/** Number of files currently being opened or converted. */
const importing = ref(0);
/** Prepended to every downloaded file name. */
const prefix = ref("cropped-");

let nextId = 0;

function ratioFor(image: CropImage): number | null {
  const preset = ASPECT_PRESETS.find((p) => p.value === aspect.value);
  const { width, height } = rotatedSize(image);

  if (!preset || preset.ratio === null) {
    return null;
  }

  if (preset.ratio === 0) {
    return width / height;
  }

  const landscape =
    orientation.value === "auto"
      ? width >= height
      : orientation.value === "landscape";

  return landscape ? preset.ratio : 1 / preset.ratio;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function defaultCrop(image: CropImage) {
  const { width, height } = rotatedSize(image);

  return centeredCrop(width, height, ratioFor(image));
}

export function useCropper() {
  const currentIndex = computed(() =>
    images.value.findIndex((img) => img.id === currentId.value),
  );
  const currentImage = computed(() => images.value[currentIndex.value] ?? null);
  const currentRatio = computed(() =>
    currentImage.value ? ratioFor(currentImage.value) : null,
  );

  async function load(image: CropImage) {
    try {
      let size;

      try {
        size = await readImageSize(image.url);
      } catch (error) {
        // HEIC outside Safari: convert it to JPEG in a Web Worker.
        if (!isHeic(image.file.name, image.file.type)) {
          throw error;
        }

        const converted = await convertHeic(image.file);

        URL.revokeObjectURL(image.url);
        image.file = converted;
        image.url = URL.createObjectURL(converted);
        image.converted = true;
        size = await readImageSize(image.url);
      }

      image.naturalWidth = size.width;
      image.naturalHeight = size.height;
      image.crop = defaultCrop(image);
    } catch {
      image.error = true;
    } finally {
      image.loading = false;
      importing.value--;
    }
  }

  /** Adds files to the list right away; each loads in the background. */
  async function addFiles(files: Iterable<File>) {
    const accepted = [...files].filter(
      (file) => file.type.startsWith("image/") || isHeic(file.name, file.type),
    );

    if (!accepted.length) {
      return [];
    }

    images.value.push(
      ...accepted.map((file): CropImage => ({
        converted: false,
        crop: { h: 1, w: 1, x: 0, y: 0 },
        edited: false,
        error: false,
        file,
        id: `img-${nextId++}`,
        loading: true,
        naturalHeight: 1,
        naturalWidth: 1,
        originalName: file.name,
        rotation: 0,
        url: URL.createObjectURL(file),
      })),
    );

    // Work on the reactive copies so the UI updates as each one loads.
    const added = images.value.slice(-accepted.length);

    importing.value += added.length;
    currentId.value ??= added[0]!.id;
    await Promise.all(added.map(load));

    return added;
  }

  function select(index: number) {
    const image = images.value[index];

    if (image) {
      currentId.value = image.id;
    }
  }

  function step(delta: number) {
    if (!images.value.length) {
      return;
    }

    const len = images.value.length;

    select((((currentIndex.value + delta) % len) + len) % len);
  }

  function setCrop(crop: CropRect) {
    if (currentImage.value) {
      currentImage.value.crop = crop;
      currentImage.value.edited = true;
    }
  }

  function resetCrop() {
    if (currentImage.value && !currentImage.value.loading) {
      currentImage.value.crop = defaultCrop(currentImage.value);
      currentImage.value.edited = false;
    }
  }

  function rotate(direction: 1 | -1) {
    const image = currentImage.value;

    if (!image || image.loading || image.error) {
      return;
    }

    image.rotation = ((image.rotation + direction * 90 + 360) %
      360) as Rotation;
    image.crop = defaultCrop(image);
    image.edited = false;
  }

  function remove(id: string) {
    const index = images.value.findIndex((img) => img.id === id);

    if (index === -1) {
      return;
    }

    const [removed] = images.value.splice(index, 1);

    URL.revokeObjectURL(removed!.url);

    if (currentId.value === id) {
      const next = images.value[Math.min(index, images.value.length - 1)];

      currentId.value = next?.id ?? null;
    }
  }

  function clear() {
    for (const img of images.value) {
      URL.revokeObjectURL(img.url);
    }

    images.value = [];
    currentId.value = null;
  }

  async function render(image: CropImage) {
    if (image.error) {
      return image.file;
    }

    return renderCroppedImage(
      image.file,
      image.url,
      image.crop,
      image.rotation,
    );
  }

  async function downloadCurrent() {
    const image = currentImage.value;

    if (!image || image.loading) {
      return;
    }

    const name = prefix.value + croppedFileName(image.file);

    saveBlob(await render(image), name);

    return name;
  }

  /**
   * Downloads every image one at a time. `onTask` receives a promise per
   * image that resolves with the saved file name once its download (and the
   * pause after it) is done, so the caller can report progress per file.
   * A failed image doesn't stop the batch when `onTask` is given.
   */
  async function downloadAll(
    onTask?: (task: Promise<string>, image: CropImage) => void,
  ) {
    if (!images.value.length || exporting.value || importing.value) {
      return;
    }

    exporting.value = true;

    try {
      const used = new Set<string>();

      for (const image of images.value) {
        const base = prefix.value + croppedFileName(image.file);
        let name = base;

        // Avoid two downloads with the same name in one batch.
        for (let n = 1; used.has(name); n++) {
          name = base.replace(/(\.[^.]+)?$/, (ext) => ` (${n})${ext}`);
        }

        used.add(name);

        const task = (async () => {
          saveBlob(await render(image), name);
          // Browsers drop downloads that are fired too close together.
          await wait(300);

          return name;
        })();

        if (!onTask) {
          await task;
          continue;
        }

        onTask(task, image);
        await task.catch(() => wait(300));
      }
    } finally {
      exporting.value = false;
    }
  }

  return {
    addFiles,
    aspect,
    clear,
    currentImage,
    currentIndex,
    currentRatio,
    downloadAll,
    downloadCurrent,
    exporting,
    images,
    importing,
    orientation,
    prefix,
    remove,
    resetCrop,
    rotate,
    select,
    setCrop,
    step,
  };
}

// Changing the aspect ratio re-fits every crop the user hasn't adjusted by
// hand, plus the one currently open.
watch([aspect, orientation], () => {
  for (const image of images.value) {
    if (
      !image.error &&
      !image.loading &&
      (!image.edited || image.id === currentId.value)
    ) {
      image.crop = defaultCrop(image);
      image.edited = false;
    }
  }
});
