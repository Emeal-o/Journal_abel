import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// True only inside a Replit workspace
const isReplit = !!process.env.REPL_ID;

export default defineConfig(async ({ command }) => {
  const isDev = command === "serve";

  // PORT is only needed when actually running the dev server (not during `vite build`)
  let port = 3000;
  if (isDev) {
    const rawPort = process.env.PORT;
    if (!rawPort) {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }
    port = Number(rawPort);
    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
  }

  // BASE_PATH is set by Replit's artifact config; defaults to "/" everywhere else (Vercel, local)
  const basePath = process.env.BASE_PATH ?? "/";

  // Replit-only plugins — never loaded outside of a Replit workspace
  const replitPlugins = isReplit
    ? [
        await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default(),
        ),
        ...(isDev
          ? [
              await import("@replit/vite-plugin-cartographer").then((m) =>
                m.cartographer({
                  root: path.resolve(import.meta.dirname, ".."),
                }),
              ),
              await import("@replit/vite-plugin-dev-banner").then((m) =>
                m.devBanner(),
              ),
            ]
          : []),
      ]
    : [];

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
