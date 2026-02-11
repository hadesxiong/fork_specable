import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    nodePolyfills({
      include: ["util", "path", "buffer", "process"],
      globals: {
        process: true,
        Buffer: true,
      },
    }),
  ],
  worker: {
    plugins: () => [
      nodePolyfills({
        include: ["util", "path", "buffer", "process"],
        globals: {
          process: true,
          Buffer: true,
        },
      }),
    ],
  },
});
