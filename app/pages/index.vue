<script setup lang="ts">
const {
  addFiles,
  aspect,
  clear,
  currentImage,
  currentIndex,
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
  step,
} = useCropper();

const toast = useToast();
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const dropActive = ref(false);
const shortcutsOpen = ref(false);

const FORMATS = ["JPEG", "PNG", "HEIC", "WebP", "AVIF", "GIF"];

const FEATURES = [
  {
    body: "Square, 3:2, 4:3, 5:4, 7:5, 16:9 or free. Portrait, landscape, or matched to each photo.",
    icon: "i-lucide-ratio",
    title: "Exact aspect ratios",
    tone: "bg-indigo-100 text-indigo-600",
  },
  {
    body: "Open a whole album, step through with the arrow keys, and download every crop in one go.",
    icon: "i-lucide-images",
    title: "Built for batches",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    body: "iPhone photos are converted to JPEG on your device. WebP, AVIF, PNG and GIF open as-is.",
    icon: "i-lucide-smartphone",
    title: "HEIC without the hassle",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    body: "Crops are saved at the original size and format. Photos you don't touch are kept byte for byte.",
    icon: "i-lucide-maximize",
    title: "Full resolution",
    tone: "bg-violet-100 text-violet-600",
  },
  {
    body: "Pick ratios, rotate, reset and download without reaching for the mouse. Press ? for the list.",
    icon: "i-lucide-keyboard",
    title: "Keyboard first",
    tone: "bg-rose-100 text-rose-600",
  },
  {
    body: "No uploads, accounts, cookies or analytics. Your photos never leave this browser tab.",
    icon: "i-lucide-shield-check",
    title: "Tracks nothing",
    tone: "bg-emerald-100 text-emerald-700",
  },
];

/** Thumbnails keep each photo's own shape (after rotation). */
function thumbStyle(image: CropImage) {
  if (image.loading || image.error) {
    return { aspectRatio: "4 / 3" };
  }

  const { width, height } = rotatedSize(image);

  return { aspectRatio: `${width} / ${height}` };
}

function thumbImageStyle(image: CropImage) {
  const { width, height } = rotatedSize(image);
  const quarterTurn = image.rotation === 90 || image.rotation === 270;
  const transform = `translate(-50%, -50%) rotate(${image.rotation}deg)`;

  // A sideways image is laid out unrotated, so its box is the frame's
  // height wide and the frame's width tall before the CSS rotation.
  return quarterTurn
    ? {
        height: `${(width / height) * 100}%`,
        transform,
        width: `${(height / width) * 100}%`,
      }
    : { height: "100%", transform, width: "100%" };
}

function thumbCropStyle(image: CropImage) {
  const { width, height } = rotatedSize(image);
  const { x, y, w, h } = image.crop;

  return {
    height: `${(h / height) * 100}%`,
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
    width: `${(w / width) * 100}%`,
  };
}

const editedCount = computed(
  () => images.value.filter((img) => img.edited).length,
);

function openPicker() {
  fileInput.value?.click();
}

async function handleFiles(files: FileList | File[] | null | undefined) {
  if (!files?.length) {
    return;
  }

  const added = await addFiles(files);
  const failed = added.filter((img) => img.error).length;

  if (!added.length) {
    toast.add({ color: "warning", title: "No images found in that selection" });
  } else if (failed) {
    toast.add({
      color: "warning",
      description: "They will be included in the download unchanged.",
      title: `${failed} image${failed === 1 ? "" : "s"} couldn't be opened`,
    });
  }
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement;

  handleFiles(input.files ? [...input.files] : null);
  // Allow picking the same files again later.
  input.value = "";
}

function onDrop(event: DragEvent) {
  dropActive.value = false;
  handleFiles(event.dataTransfer?.files);
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function onDownloadAll() {
  try {
    await downloadAll((task, image) => {
      toast.promise(task, {
        error: (error) => ({
          color: "error",
          description: errorMessage(error),
          icon: "i-lucide-circle-x",
          title: `Couldn't export ${image.originalName}`,
        }),
        loading: { title: `Exporting ${image.originalName}...` },
        success: (name) => ({
          color: "success",
          description: name,
          icon: "i-lucide-check",
          title: "Downloaded",
        }),
      });
    });
  } catch (error) {
    toast.add({
      color: "error",
      description: errorMessage(error),
      title: "Export failed",
    });
  }
}

async function onDownloadCurrent() {
  const image = currentImage.value;

  if (!image || image.loading) {
    return;
  }

  await toast
    .promise(downloadCurrent(), {
      error: (error) => ({
        color: "error",
        description: errorMessage(error),
        icon: "i-lucide-circle-x",
        title: `Couldn't export ${image.originalName}`,
      }),
      loading: { title: `Exporting ${image.originalName}...` },
      success: (name) => ({
        color: "success",
        description: name,
        icon: "i-lucide-check",
        title: "Downloaded",
      }),
    })
    .catch(() => {});
}

const ORIENTATION_CYCLE: Orientation[] = ["portrait", "landscape", "auto"];

/** Shortcuts that work with ⌘ (Mac) or Ctrl (everywhere else). */
function onModifierShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();

  if (key === "o" && !event.shiftKey) {
    openPicker();
  } else if (key === "s" && event.shiftKey && images.value.length) {
    onDownloadAll();
  } else if (key === "s" && !event.shiftKey && images.value.length) {
    onDownloadCurrent();
  } else {
    return;
  }

  event.preventDefault();
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;

  if (
    event.altKey ||
    target?.closest("input, textarea, select, [role='listbox'], [role='menu']")
  ) {
    return;
  }

  if (event.metaKey || event.ctrlKey) {
    onModifierShortcut(event);

    return;
  }

  if (event.key === "?") {
    shortcutsOpen.value = !shortcutsOpen.value;
    event.preventDefault();

    return;
  }

  // Everything below acts on the editor; ignore it while a dialog is open.
  if (!images.value.length || shortcutsOpen.value) {
    return;
  }

  const key = event.key.toLowerCase();
  const preset = ASPECT_PRESETS[Number(event.key) - 1];

  if (key === "arrowright") {
    step(1);
  } else if (key === "arrowleft") {
    step(-1);
  } else if (preset) {
    aspect.value = preset.value;
  } else if (key === "o") {
    const next =
      (ORIENTATION_CYCLE.indexOf(orientation.value) + 1) %
      ORIENTATION_CYCLE.length;

    orientation.value = ORIENTATION_CYCLE[next]!;
  } else if (key === "r") {
    resetCrop();
  } else if (key === "[") {
    rotate(-1);
  } else if (key === "]") {
    rotate(1);
  } else if ((key === "delete" || key === "backspace") && currentImage.value) {
    remove(currentImage.value.id);
  } else {
    return;
  }

  event.preventDefault();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div
    class="h-dvh"
    @dragover.prevent="dropActive = true"
    @dragleave.self="dropActive = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      class="hidden"
      @change="onInputChange"
    />

    <ShortcutsHelp v-model:open="shortcutsOpen" />

    <!-- Empty state: hero, then features below the fold -->
    <div v-if="!images.length" class="h-full overflow-y-auto">
      <section
        class="flex min-h-[88dvh] flex-col items-center justify-center gap-8 p-6"
      >
        <AppLogo />

        <button
          type="button"
          class="card group flex w-full max-w-lg cursor-pointer flex-col items-center gap-6 px-8 pt-12 pb-10 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          :class="{
            'ring-primary -translate-y-0.5 shadow-lg ring-2': dropActive,
          }"
          @click="openPicker"
        >
          <!-- Fanned stack of photo prints -->
          <span class="relative h-24 w-32" aria-hidden="true">
            <span
              class="absolute inset-0 -translate-x-6 translate-y-1 -rotate-[10deg] rounded-md bg-white p-1.5 shadow-md ring-1 ring-black/5 transition duration-300 group-hover:-translate-x-9 group-hover:-rotate-[16deg]"
            >
              <span class="block size-full rounded-sm bg-amber-200" />
            </span>

            <span
              class="absolute inset-0 translate-x-6 translate-y-1 rotate-[9deg] rounded-md bg-white p-1.5 shadow-md ring-1 ring-black/5 transition duration-300 group-hover:translate-x-9 group-hover:rotate-[15deg]"
            >
              <span class="block size-full rounded-sm bg-sky-200" />
            </span>

            <span
              class="absolute inset-0 rounded-md bg-white p-1.5 shadow-lg ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1.5"
            >
              <span
                class="grid size-full place-items-center rounded-sm bg-gradient-to-br from-indigo-400 to-violet-600 text-white"
              >
                <UIcon name="i-lucide-crop" class="size-7" />
              </span>
            </span>
          </span>

          <span class="space-y-2">
            <span class="block text-2xl font-bold tracking-tight">
              Crop a whole album
            </span>

            <span class="text-muted block text-sm">
              Drop photos anywhere on this page, crop each one, then download
              them all. Nothing is uploaded or tracked.
            </span>
          </span>

          <span
            class="bg-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:shadow-md group-active:scale-[0.97]"
          >
            <UIcon name="i-lucide-image-plus" class="size-4" />
            Choose photos
          </span>
        </button>

        <div class="flex flex-wrap justify-center gap-2">
          <span
            v-for="format in FORMATS"
            :key="format"
            class="text-muted rounded-md bg-white/70 px-3 py-1 text-xs font-medium ring-1 ring-(--card-ring)"
          >
            {{ format }}
          </span>
        </div>

        <button
          type="button"
          class="text-dimmed hover:text-muted flex cursor-pointer items-center gap-1.5 text-xs transition"
          @click="shortcutsOpen = true"
        >
          <UKbd value="meta" />

          <UKbd value="O" />
          to add photos ·
          <UKbd value="?" />
          for all shortcuts
        </button>
      </section>

      <section class="mx-auto max-w-5xl px-6 pb-16" aria-labelledby="features">
        <div class="mb-8 text-center">
          <p
            class="text-primary text-xs font-semibold tracking-wider uppercase"
          >
            Why it exists
          </p>

          <h2 id="features" class="mt-2 text-2xl font-bold tracking-tight">
            Cropping that the built-in tools forgot
          </h2>

          <p class="text-muted mx-auto mt-2 max-w-md text-sm">
            The image tools on macOS and Linux make cropping to a ratio a chore.
            This does one job well, right in your browser.
          </p>
        </div>

        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="feature in FEATURES"
            :key="feature.title"
            class="card flex gap-4 p-5"
          >
            <span
              class="grid size-10 shrink-0 place-items-center rounded-lg"
              :class="feature.tone"
            >
              <UIcon :name="feature.icon" class="size-5" />
            </span>

            <span class="space-y-1">
              <span class="block text-sm font-semibold">
                {{ feature.title }}
              </span>

              <span class="text-muted block text-sm leading-relaxed">
                {{ feature.body }}
              </span>
            </span>
          </li>
        </ul>
      </section>

      <footer
        class="text-dimmed flex flex-col items-center gap-1 px-6 pb-8 text-center text-xs"
      >
        <span class="flex items-center gap-1.5">
          <UIcon name="i-lucide-lock" class="size-3.5" />
          Runs entirely in your browser. Nothing is uploaded or tracked.
        </span>
      </footer>
    </div>

    <!-- Editor: cards floating on the grey page -->
    <div v-else class="flex h-full flex-col gap-3 p-3">
      <header class="card flex h-14 shrink-0 items-center gap-2 px-4">
        <AppLogo class="mr-auto" />

        <UBadge
          v-if="importing"
          color="neutral"
          variant="soft"
          icon="i-lucide-loader-circle"
          :ui="{ leadingIcon: 'animate-spin' }"
          :label="`Opening ${importing}…`"
        />

        <UTooltip text="Keyboard shortcuts" :kbds="['?']">
          <UButton
            icon="i-lucide-keyboard"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Keyboard shortcuts"
            @click="shortcutsOpen = true"
          />
        </UTooltip>

        <UTooltip text="Add photos" :kbds="['meta', 'O']">
          <UButton
            icon="i-lucide-image-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            label="Add photos"
            @click="openPicker"
          />
        </UTooltip>

        <USeparator orientation="vertical" class="h-6" />

        <label
          class="bg-muted focus-within:ring-primary flex h-8 items-center gap-2 rounded-md px-3 text-sm ring-1 ring-transparent transition focus-within:ring-2"
        >
          <span class="text-muted text-xs">Prefix</span>

          <input
            v-model="prefix"
            class="w-24 bg-transparent outline-none placeholder:text-(--ui-text-dimmed)"
            placeholder="none"
            spellcheck="false"
          />
        </label>

        <UTooltip text="Download this photo" :kbds="['meta', 'S']">
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            size="sm"
            label="This photo"
            :disabled="!currentImage || currentImage.loading"
            @click="onDownloadCurrent"
          />
        </UTooltip>

        <UTooltip text="Download every photo" :kbds="['meta', 'shift', 'S']">
          <UButton
            icon="i-lucide-files"
            size="sm"
            :label="`Download all ${images.length}`"
            :loading="exporting"
            :disabled="importing > 0"
            @click="onDownloadAll"
          />
        </UTooltip>
      </header>

      <div class="flex min-h-0 flex-1 gap-3">
        <aside class="card flex w-48 shrink-0 flex-col max-md:hidden">
          <div class="flex items-center justify-between px-4 pt-3 pb-2">
            <span
              class="text-muted text-xs font-semibold tracking-wide uppercase"
            >
              {{ editedCount }} of {{ images.length }} cropped
            </span>

            <UButton
              label="Clear"
              color="neutral"
              variant="link"
              size="xs"
              class="px-0"
              @click="clear"
            />
          </div>

          <ul class="flex-1 space-y-2.5 overflow-y-auto px-3 pt-1 pb-3">
            <li
              v-for="(image, index) in images"
              :key="image.id"
              class="group relative"
            >
              <button
                type="button"
                class="bg-muted relative block w-full cursor-pointer overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-(--ui-bg) transition"
                :style="thumbStyle(image)"
                :class="
                  index === currentIndex
                    ? 'ring-primary'
                    : 'ring-transparent hover:ring-(--ui-border-accented)'
                "
                :title="image.file.name"
                @click="select(index)"
              >
                <span
                  v-if="image.loading"
                  class="text-muted grid size-full place-items-center"
                >
                  <UIcon
                    name="i-lucide-loader-circle"
                    class="size-5 animate-spin"
                  />
                </span>

                <template v-else-if="!image.error">
                  <img
                    :src="image.url"
                    :alt="image.file.name"
                    loading="lazy"
                    class="absolute top-1/2 left-1/2 max-w-none"
                    :style="thumbImageStyle(image)"
                  />

                  <!-- Current crop, so you can see what will be kept -->
                  <span
                    class="pointer-events-none absolute rounded-[3px] shadow-[0_0_0_999px_rgb(0_0_0/0.35)] outline outline-white/80"
                    :style="thumbCropStyle(image)"
                  />
                </template>

                <span
                  v-else
                  class="text-muted grid size-full place-items-center text-xs"
                >
                  Can't preview
                </span>
              </button>

              <span
                v-if="image.edited || image.rotation"
                class="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
                title="You've adjusted the crop or rotation of this photo"
              >
                <UIcon name="i-lucide-crop" class="size-3" />
                Edited
              </span>

              <span
                v-if="image.converted"
                class="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
                title="Converted from HEIC so the browser can open it"
              >
                HEIC
              </span>

              <button
                type="button"
                class="absolute top-1.5 right-1.5 grid size-6 cursor-pointer place-items-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
                aria-label="Remove photo"
                @click="remove(image.id)"
              >
                <UIcon name="i-lucide-x" class="size-3.5" />
              </button>
            </li>
          </ul>
        </aside>

        <main class="card flex min-w-0 flex-1 flex-col gap-2 p-2">
          <div
            class="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-neutral-900 px-6 pt-6 pb-16"
          >
            <CropEditor />

            <!-- Floating navigation pill -->
            <div class="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div
                class="flex max-w-full items-center gap-1 rounded-lg bg-white/10 p-1 text-sm text-white/90 ring-1 ring-white/10 backdrop-blur-md"
              >
                <button
                  type="button"
                  class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition hover:bg-white/15 active:scale-95"
                  aria-label="Previous photo"
                  @click="step(-1)"
                >
                  <UIcon name="i-lucide-chevron-left" class="size-4" />
                </button>

                <span class="min-w-0 truncate px-2 tabular-nums">
                  <span class="font-semibold">
                    {{ currentIndex + 1 }} / {{ images.length }}
                  </span>

                  <template v-if="currentImage">
                    <span class="text-white/60">
                      · {{ currentImage.file.name }}
                    </span>

                    <span
                      v-if="!currentImage.error && !currentImage.loading"
                      class="text-white/60"
                    >
                      · {{ Math.round(currentImage.crop.w) }} ×
                      {{ Math.round(currentImage.crop.h) }}
                    </span>
                  </template>
                </span>

                <UTooltip
                  v-if="currentImage?.converted"
                  :text="`${currentImage.originalName} was converted to JPEG so the browser can open it. It downloads as a JPEG.`"
                >
                  <span
                    class="mr-1 flex shrink-0 items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-xs font-medium"
                  >
                    <UIcon name="i-lucide-repeat" class="size-3" />
                    {{
                      currentImage.originalName.split(".").pop()?.toUpperCase()
                    }}
                    → JPEG
                  </span>
                </UTooltip>

                <button
                  type="button"
                  class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition hover:bg-white/15 active:scale-95"
                  aria-label="Next photo"
                  @click="step(1)"
                >
                  <UIcon name="i-lucide-chevron-right" class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <AspectBar />
        </main>
      </div>
    </div>
  </div>
</template>
