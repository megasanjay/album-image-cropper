<script setup lang="ts">
const { currentImage, currentRatio, setCrop } = useCropper();

const HANDLES: { id: CropHandle; left: string; top: string; cursor: string }[] =
  [
    { cursor: "nwse-resize", id: "nw", left: "0%", top: "0%" },
    { cursor: "ns-resize", id: "n", left: "50%", top: "0%" },
    { cursor: "nesw-resize", id: "ne", left: "100%", top: "0%" },
    { cursor: "ew-resize", id: "e", left: "100%", top: "50%" },
    { cursor: "nwse-resize", id: "se", left: "100%", top: "100%" },
    { cursor: "ns-resize", id: "s", left: "50%", top: "100%" },
    { cursor: "nesw-resize", id: "sw", left: "0%", top: "100%" },
    { cursor: "ew-resize", id: "w", left: "0%", top: "50%" },
  ];

const container = useTemplateRef<HTMLDivElement>("container");
const stage = useTemplateRef<HTMLDivElement>("stage");
const containerSize = reactive({ h: 0, w: 0 });

let observer: ResizeObserver | null = null;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) {
      containerSize.w = entry.contentRect.width;
      containerSize.h = entry.contentRect.height;
    }
  });

  if (container.value) {
    observer.observe(container.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());

const size = computed(() =>
  currentImage.value
    ? rotatedSize(currentImage.value)
    : { height: 1, width: 1 },
);

/** Screen pixels per image pixel. */
const scale = computed(() => {
  if (!containerSize.w || !containerSize.h) {
    return 0;
  }

  return Math.min(
    containerSize.w / size.value.width,
    containerSize.h / size.value.height,
  );
});

const stageStyle = computed(() => ({
  height: `${size.value.height * scale.value}px`,
  width: `${size.value.width * scale.value}px`,
}));

// The <img> is laid out unrotated and turned with CSS around the stage
// center, so its unrotated box is centered and sized by the natural size.
const imageStyle = computed(() => {
  const image = currentImage.value;

  if (!image) {
    return {};
  }

  return {
    height: `${image.naturalHeight * scale.value}px`,
    transform: `translate(-50%, -50%) rotate(${image.rotation}deg)`,
    width: `${image.naturalWidth * scale.value}px`,
  };
});

const boxStyle = computed(() => {
  const crop = currentImage.value?.crop;
  const s = scale.value;

  if (!crop) {
    return {};
  }

  return {
    height: `${crop.h * s}px`,
    left: `${crop.x * s}px`,
    top: `${crop.y * s}px`,
    width: `${crop.w * s}px`,
  };
});

const cropLabel = computed(() => {
  const crop = currentImage.value?.crop;

  return crop ? `${Math.round(crop.w)} × ${Math.round(crop.h)}` : "";
});

let drag: {
  mode: CropDrag;
  startX: number;
  startY: number;
  startCrop: CropRect;
  moved: boolean;
} | null = null;

const dragging = ref(false);

function toImagePoint(event: PointerEvent) {
  const rect = stage.value!.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / scale.value,
    y: (event.clientY - rect.top) / scale.value,
  };
}

function onPointerDown(
  event: PointerEvent,
  target: "stage" | "box" | CropHandle,
) {
  const image = currentImage.value;

  if (!image || event.button !== 0 || !scale.value) {
    return;
  }

  event.preventDefault();
  stage.value!.setPointerCapture(event.pointerId);

  const point = toImagePoint(event);
  const crop = { ...image.crop };
  let mode: CropDrag;

  if (target === "stage") {
    // Draw a brand new box from where the pointer went down.
    const x = Math.min(Math.max(point.x, 0), size.value.width);
    const y = Math.min(Math.max(point.y, 0), size.value.height);

    mode = { ax: x, ay: y, kind: "span", px: x, py: y };
  } else if (target === "box") {
    mode = { kind: "move" };
  } else if (target.length === 2) {
    const west = target.includes("w");
    const north = target.includes("n");

    mode = {
      ax: west ? crop.x + crop.w : crop.x,
      ay: north ? crop.y + crop.h : crop.y,
      kind: "span",
      px: west ? crop.x : crop.x + crop.w,
      py: north ? crop.y : crop.y + crop.h,
    };
  } else {
    mode = { handle: target as "n" | "s" | "e" | "w", kind: "edge" };
  }

  drag = {
    mode,
    moved: false,
    startCrop: crop,
    startX: point.x,
    startY: point.y,
  };
  dragging.value = true;
}

function onPointerMove(event: PointerEvent) {
  if (!drag) {
    return;
  }

  const point = toImagePoint(event);
  const dx = point.x - drag.startX;
  const dy = point.y - drag.startY;

  // Ignore jitter so a plain click doesn't replace the crop.
  if (!drag.moved && Math.hypot(dx, dy) * scale.value < 3) {
    return;
  }

  drag.moved = true;
  setCrop(
    applyCropDrag(
      drag.mode,
      drag.startCrop,
      dx,
      dy,
      size.value.width,
      size.value.height,
      currentRatio.value,
    ),
  );
}

function onPointerUp(event: PointerEvent) {
  if (stage.value?.hasPointerCapture(event.pointerId)) {
    stage.value.releasePointerCapture(event.pointerId);
  }

  drag = null;
  dragging.value = false;
}
</script>

<template>
  <div
    ref="container"
    class="flex size-full min-h-0 min-w-0 items-center justify-center"
  >
    <div
      v-if="
        currentImage && !currentImage.loading && !currentImage.error && scale
      "
      ref="stage"
      class="relative cursor-crosshair touch-none overflow-hidden select-none"
      :style="stageStyle"
      @pointerdown="onPointerDown($event, 'stage')"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        :src="currentImage.url"
        :alt="currentImage.file.name"
        draggable="false"
        class="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
        :style="imageStyle"
      />

      <div
        class="absolute cursor-move outline outline-white/90 transition-shadow duration-200 ease-out"
        :style="boxStyle"
        :class="
          dragging
            ? 'shadow-[0_0_0_9999px_rgb(0_0_0/0.72)]'
            : 'shadow-[0_0_0_9999px_rgb(0_0_0/0.6)]'
        "
        @pointerdown.stop="onPointerDown($event, 'box')"
      >
        <!-- Rule of thirds. While dragging, the photo inside the box is
             dimmed so the grid stands out. -->
        <div
          class="pointer-events-none absolute inset-0 transition-[background-color,opacity] duration-200 ease-out *:bg-white *:shadow-[0_0_1px_rgb(0_0_0/0.6)]"
          :class="
            dragging ? 'bg-black/35 opacity-100' : 'bg-black/0 opacity-50'
          "
        >
          <div class="absolute inset-y-0 left-1/3 w-px" />

          <div class="absolute inset-y-0 left-2/3 w-px" />

          <div class="absolute inset-x-0 top-1/3 h-px" />

          <div class="absolute inset-x-0 top-2/3 h-px" />
        </div>

        <div
          v-if="dragging"
          class="pointer-events-none absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white tabular-nums"
        >
          {{ cropLabel }}
        </div>

        <div
          v-for="handle in HANDLES"
          :key="handle.id"
          class="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
          :style="{ left: handle.left, top: handle.top, cursor: handle.cursor }"
          @pointerdown.stop="onPointerDown($event, handle.id)"
        >
          <span
            class="bg-white shadow ring-1 ring-black/40"
            :class="
              handle.id.length === 2
                ? 'size-3 rounded-full'
                : handle.id === 'n' || handle.id === 's'
                  ? 'h-1.5 w-5 rounded-full'
                  : 'h-5 w-1.5 rounded-full'
            "
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="currentImage?.loading"
      class="flex items-center gap-2 text-sm text-white/70"
    >
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      Opening {{ currentImage.file.name }}…
    </div>

    <div
      v-else-if="currentImage?.error"
      class="text-center text-sm text-white/70"
    >
      This browser can't open {{ currentImage.file.name }}.<br />
      It will be included in the download unchanged.
    </div>
  </div>
</template>
