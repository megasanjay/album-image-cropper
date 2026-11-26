export default defineAppConfig({
  ui: {
    button: {
      slots: {
        // Small press feedback on every button.
        base: "cursor-pointer rounded-md transition active:scale-[0.97]",
      },
    },
    colors: {
      neutral: "neutral",
      primary: "indigo",
    },
    input: {
      slots: {
        root: "w-full",
      },
    },
  },
});
