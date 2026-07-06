import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Shared esbuild options used by every entry point in this package.
const sharedOptions = {
  platform: "node",
  bundle: true,
  format: "esm",
  logLevel: "info",
  // Some packages may not be bundleable, so we externalize them.
  // Examples of unbundleable packages:
  // - uses native modules and loads them dynamically (e.g. sharp)
  // - use path traversal to read files (e.g. @google-cloud/secret-manager)
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "@google/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "@tree-sitter/*",
    "aws-sdk",
    "classic-level",
    "dd-trace",
    "ffi-napi",
    "grpc",
    "hiredis",
    "kerberos",
    "leveldown",
    "miniflare",
    "mysql2",
    "newrelic",
    "odbc",
    "piscina",
    "realm",
    "ref-napi",
    "rocksdb",
    "sass-embedded",
    "sequelize",
    "serialport",
    "snappy",
    "tinypool",
    "usb",
    "workerd",
    "wrangler",
    "zeromq",
    "zeromq-prebuilt",
    "playwright",
    "puppeteer",
    "puppeteer-core",
    "electron",
  ],
  sourcemap: "linked",
  plugins: [
    // pino relies on workers to handle logging; use the plugin instead of externalizing
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
  // Make sure CJS-only packages (e.g. express) continue to work in ESM output
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // --- 1. Full server entry point (local / non-serverless) ---
  await esbuild({
    ...sharedOptions,
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
  });

  // --- 2. Serverless entry point for Vercel (exports Express app, no listen()) ---
  await esbuild({
    ...sharedOptions,
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
