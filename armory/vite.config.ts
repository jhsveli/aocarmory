import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import postcssCustomMedia from "postcss-custom-media";
import postcssGlobalData from "@csstools/postcss-global-data";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Single source of truth for @custom-media breakpoints (see
      // src/styles/media.css). postcss-global-data makes the definitions
      // available to every (module) stylesheet, so modules write
      // `@media (--screen-narrow)` instead of duplicating pixel values.
      plugins: [
        postcssGlobalData({ files: ["src/styles/media.css"] }),
        postcssCustomMedia(),
      ],
    },
  },
});
