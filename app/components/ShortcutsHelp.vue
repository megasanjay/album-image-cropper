<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false });

/** Each entry is a list of key combos; each combo is a list of keys. */
const SHORTCUTS: { combos: string[][]; label: string; joiner?: string }[] = [
  { combos: [["arrowleft"], ["arrowright"]], label: "Previous / next photo" },
  {
    combos: [["1"], ["8"]],
    joiner: "-",
    label: "Aspect ratio (again to flip)",
  },
  { combos: [["O"]], label: "Switch this photo's orientation" },
  { combos: [["["], ["]"]], label: "Rotate left / right" },
  { combos: [["R"]], label: "Reset crop" },
  { combos: [["backspace"]], label: "Remove photo" },
  { combos: [["meta", "O"]], label: "Add photos" },
  { combos: [["meta", "S"]], label: "Download this photo" },
  { combos: [["meta", "shift", "S"]], label: "Download all" },
  { combos: [["?"]], label: "Show shortcuts" },
];
</script>

<template>
  <UModal
    v-model:open="open"
    title="Keyboard shortcuts"
    :ui="{ content: 'max-w-sm' }"
  >
    <template #body>
      <ul class="space-y-3 text-sm">
        <li
          v-for="shortcut in SHORTCUTS"
          :key="shortcut.label"
          class="flex items-center justify-between gap-4"
        >
          <span class="text-muted">{{ shortcut.label }}</span>

          <span class="flex items-center gap-1">
            <template v-for="(combo, i) in shortcut.combos" :key="i">
              <span v-if="i > 0" class="text-dimmed px-0.5 text-xs">
                {{ shortcut.joiner ?? "/" }}
              </span>

              <UKbd v-for="key in combo" :key="key" :value="key" />
            </template>
          </span>
        </li>
      </ul>
    </template>
  </UModal>
</template>
