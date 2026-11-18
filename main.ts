// Solmar City — the entrypoint for make.fun's gta6-01 bounty (Node 22,
// standard library only). The game itself is plain static files under
// game/ (game/index.html plus its ES modules, no library, no network),
// and this program hands it in: it copies game/ and screenshots/ next
// to this file into the output directory and writes dossier.json there
// with the vendored make.fun library, so the judge can read the entry.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file lives in.
const repoRoot = dirname(fileURLToPath(import.meta.url));
// The grader hands us /output; locally MAKEFUN_OUTPUT_DIR stands in.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The gate's own caps, so an entry this program accepts is one the
// scorer accepts too: at most 4 screenshots of 256 KiB each, game/ at
// most 993 files and 48 MiB in all, paths at most 1000 bytes, and the
// dossier text capped at 160 KiB.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);
