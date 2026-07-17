# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

CLI pipeline that runs the same IFC files through three parsers — [`web-ifc`](_external/web-ifc-0.0.68/), [`ifcopenshell`](_external/ifcopenshell-0.8.4/), [`ifc-lite`](_external/ifc-lite-2.1.3/) — and produces an HTML report comparing their metadata, spatial trees, entity counts, geometry, transform matrices, and per-view pixel diffs of rendered screenshots.

Each run writes to `_ifc-output/<timestamp>/` with per-parser JSON, screenshots, pairwise diff images, and the generated report.

## Common commands

- `pnpm install` — install dependencies (pnpm, not npm).
- `pnpm start` — Docker mode. Each parser runs inside its prebuilt image; build images first with `bash docker/run.sh` (also runs the evaluator), or build them individually from `docker/Dockerfile.<parser>`.
- `pnpm start:local` — Local mode. Sets `PARSERS_LOCAL=true` so [parsers-runner.service.ts](src/parsers-runner/parsers-runner.service.ts#L52-L54) invokes `_external/<parser>/run-local.sh` (native `npm`/`tsx`/`python` via conda) instead of `run.sh` (docker).
- `pnpm build` — Nest build + renderer build. The browser-side renderer at [src/geometry-renderer/public/](src/geometry-renderer/public/) is excluded from the main `tsconfig.json` and has its own [tsconfig](src/geometry-renderer/public/tsconfig.json); rebuild it standalone with `pnpm build:renderer` after editing it.
- `pnpm test` / `pnpm test:watch` — Jest. Tests live next to their sources as `*.spec.ts` under `src/`. Run a single test with `pnpm test -- src/results-comparer/services/image-comparer.service.spec.ts` or filter with `pnpm test -- -t "<name pattern>"`.
- `pnpm lint` — ESLint with `--fix`.

## Pipeline architecture

Entrypoint is a NestJS [`nest-commander`](https://github.com/jmcdo29/nest-commander) CLI ([src/main.ts](src/main.ts), [src/app.module.ts](src/app.module.ts)). The root command in [src/cli/commands/root.command.ts](src/cli/commands/root.command.ts) hardcodes the parser list, the IFC input list, and a timestamped output dir, then runs five sub-commands in order — each is a `@Command`-decorated class injected via DI:

1. **`execute-parsers`** — [ParsersRunnerService](src/parsers-runner/parsers-runner.service.ts) spawns `_external/<parser>/run.sh` (or `run-local.sh` when `PARSERS_LOCAL=true`) as a bash subprocess, passing the IFC file list (as a JSON string) and an output dir. Each parser writes one JSON per IFC file matching the [output schema](docs/OUTPUT_FORMAT.md). 10-minute timeout per parser.
2. **`generate-screenshots`** — [WebBrowserService](src/geometry-renderer/web-browser.service.ts) starts an Express server ([GeometryRendererService](src/geometry-renderer/geometry-renderer.service.ts), port 3000) serving the Three.js renderer in [src/geometry-renderer/public/](src/geometry-renderer/public/), then drives it via Puppeteer to render five views (`front`/`left`/`right`/`top`/`perspective`) of each parser's geometry. Two passes per view — clean (`<view>.png`) and a vertex-duplication heatmap (`<view>--spheres.png`, red spheres scaled by how many times each `(x,y,z)` appears). A shared bounding box is set per IFC file so all parsers render in the same camera frame, making pixel diffs meaningful even when parsers disagree about which entities to include.
3. **`compare-results`** — [ComparisonService](src/results-comparer/services/comparison.service.ts) compares parser JSONs: metadata, summary (entity counts by type), spatial tree (node count + recursive diff by `globalId`), geometry (per-entity vertex/triangle/line counts, unique-vertex counts via 5-decimal quantization, and 4x4 matrix equality within `1e-5`).
4. **`compare-images`** — [ImageComparerService](src/results-comparer/services/image-comparer.service.ts) runs pixelmatch on every pair × view × variant.
5. **`generate-report`** — [ReportGeneratorService](src/results-comparer/services/report-generator.service.ts) renders [Handlebars templates](src/results-comparer/templates/) into a single HTML report with charts ([ChartExportService](src/results-comparer/services/chart-export.service.ts) uses chartjs-node-canvas).

State is passed between commands through the `props` argument to `run(args, props)` rather than through Nest DI singletons — `CompareResultsCommand.getLastComparisons()` is how step 3 hands data to steps 4–5.

## Parser contract

Every parser under `_external/<parser>/` must:
- expose an executable `run.sh` (docker mode) and `run-local.sh` (local mode); both take two args: a JSON-stringified array of IFC file paths and an output directory.
- write one JSON per input IFC file conforming to [docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md) (v2.0.0; schema in [docs/output-schema.json](docs/output-schema.json)). Key invariants: geometry entries keyed by `globalId`, each entry has `ifcClass` + `matrix` + at least one of `mesh` (triangulated) or `lines` (polylines, indices as pairs); coordinates in meters, Z-up; entities without renderable geometry must be omitted from `geometries` entirely.

When the docker `run.sh` is invoked from inside the evaluator container, it rewrites host paths to `/app/_ifc-input` and `/app/_ifc-output` using `HOST_PROJECT_ROOT` — see e.g. [_external/web-ifc-0.0.68/run.sh](_external/web-ifc-0.0.68/run.sh).

## Modifying input files

The list of IFC files to evaluate is a hardcoded `IFC_FILES` array in [src/cli/commands/root.command.ts](src/cli/commands/root.command.ts#L11-L33). Add or comment out paths there; commented `_ifc-input/others/` entries are intentionally skipped. The parser list (`PARSERS`) is right above it.

## Conventions

- TypeScript with `strict: false` but `strictNullChecks: true` — explicit null checks are required, but `noImplicitAny` is off.
- camelCase fields throughout, including in the parser JSON output (the IFC class prefix is preserved — `IfcBeam`, not `ifcBeam`).
- The repo contains Polish-language error strings in places (e.g. `"Nie podano żadnych plików IFC."`) — match the surrounding code's language when editing rather than translating.
