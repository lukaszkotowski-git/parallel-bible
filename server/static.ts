import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Vite nadaje plikom w /assets hash w nazwie → można je cache'ować „na zawsze".
  // index.html i reszta (favicon) muszą być rewalidowane, inaczej klient utknie na starym buildzie.
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader(
          "Cache-Control",
          hashed ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
