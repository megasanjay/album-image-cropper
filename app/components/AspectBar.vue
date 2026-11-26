<script setup lang="ts">
const { aspect, currentImage, orientation, resetCrop, rotate } = useCropper();

const ORIENTATIONS: { value: Orientation; label: string; icon: string }[] = [
  {
    icon: "i-lucide-rectangle-horizontal",
    label: "Landscape",
    value: "landscape",
  },
  { icon: "i-lucide-rectangle-vertical", label: "Portrait", value: "portrait" },
  { icon: "i-lucide-wand-sparkles", label: "Match each photo", value: "auto" },
];

/** Largest side of the little ratio preview shape, in px. */
const ICON_SIZE = 20;

const editable = computed(
  () =>
    !!currentImage.value &&
    !currentImage.value.loading &&
    !currentImage.value.error,
);

const portrait = computed(() => {
  if (orientation.value === "portrait") {
    return true;
  }

  if (orientation.value === "auto" && currentImage.value) {
    const { width, height } = rotatedSize(currentImage.value);

    return height > width;
  }

  return false;
});

const fixedRatio = computed(
  () => aspect.value !== "free" && aspect.value !== "original",
);

/** Size of the ratio preview shape for a preset, following orientation. */
function shapeStyle(preset: AspectPreset) {
  const ratio = preset.ratio || 4 / 3;
  let w = ICON_SIZE;
  let h = ICON_SIZE / ratio;

  if (portrait.value) {
    [w, h] = [h, w];
  }

  return { height: `${h}px`, width: `${w}px` };
}

function presetTooltip(preset: AspectPreset) {
  if (preset.value === "free") {
    return "Free crop";
  }

  if (preset.value === "original") {
    return "Original ratio";
  }

  return `${preset.label} ratio`;
}
</script>

<template>
  <div class="flex items-center gap-3 overflow-x-auto px-1 py-1">
    <!-- Image tools -->
    <div class="flex shrink-0 items-center gap-1">
      <UTooltip text="Rotate left" :kbds="['[']">
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          aria-label="Rotate left"
          :disabled="!editable"
          @click="rotate(-1)"
        />
      </UTooltip>

      <UTooltip text="Rotate right" :kbds="[']']">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          aria-label="Rotate right"
          :disabled="!editable"
          @click="rotate(1)"
        />
      </UTooltip>

      <UTooltip text="Reset crop" :kbds="['R']">
        <UButton
          icon="i-lucide-undo-2"
          color="neutral"
          variant="ghost"
          aria-label="Reset crop"
          :disabled="!editable"
          @click="resetCrop"
        />
      </UTooltip>
    </div>

    <!-- Aspect ratios -->
    <div
      class="bg-muted mx-auto flex shrink-0 items-center gap-0.5 rounded-lg p-1"
      role="radiogroup"
      aria-label="Aspect ratio"
    >
      <UTooltip
        v-for="(preset, index) in ASPECT_PRESETS"
        :key="preset.value"
        :text="presetTooltip(preset)"
        :kbds="[String(index + 1)]"
      >
        <button
          type="button"
          role="radio"
          class="flex w-14 cursor-pointer flex-col items-center gap-1.5 rounded-md px-1 pt-2 pb-1.5 transition active:scale-[0.97]"
          :class="
            aspect === preset.value
              ? 'bg-default text-primary shadow-sm'
              : 'text-muted hover:text-default'
          "
          :aria-checked="aspect === preset.value"
          @click="aspect = preset.value"
        >
          <span class="grid size-5 place-items-center">
            <UIcon
              v-if="preset.value === 'original'"
              name="i-lucide-image"
              class="size-5"
            />

            <span
              v-else
              class="rounded-[3px] border-[1.5px] border-current transition-all"
              :class="{ 'border-dashed': preset.value === 'free' }"
              :style="shapeStyle(preset)"
            />
          </span>

          <span class="text-[11px] leading-none font-medium">
            {{ preset.label }}
          </span>
        </button>
      </UTooltip>
    </div>

    <!-- Orientation -->
    <div
      class="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-1"
      role="radiogroup"
      aria-label="Orientation"
    >
      <UTooltip
        v-for="item in ORIENTATIONS"
        :key="item.value"
        :text="fixedRatio ? item.label : `${item.label} (pick a ratio first)`"
        :kbds="['O']"
      >
        <button
          type="button"
          role="radio"
          class="grid size-9 cursor-pointer place-items-center rounded-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          :class="
            orientation === item.value && fixedRatio
              ? 'bg-default text-primary shadow-sm'
              : 'text-muted enabled:hover:text-default'
          "
          :disabled="!fixedRatio"
          :aria-label="item.label"
          :aria-checked="orientation === item.value"
          @click="orientation = item.value"
        >
          <UIcon :name="item.icon" class="size-5" />
        </button>
      </UTooltip>
    </div>
  </div>
</template>
