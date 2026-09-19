import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "node:fs/promises";

// Zależności serwera wciągane do bundla (mniej openat(2) → szybszy cold start).
// Tylko pakiety, które serwer faktycznie importuje: reszta zostaje zewnętrznym require().
// Nowa zależność runtime'owa, która ma trafić do bundla, musi się tu znaleźć.
const allowlist = [
  // better-auth jest ESM-only — jako external `require()` z bundla CJS bywa
  // zawodny, więc wciągamy go do bundla razem z zależnościami przechodnimi.
  "better-auth",
  "express",
  "nanoid",
  "zod",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
