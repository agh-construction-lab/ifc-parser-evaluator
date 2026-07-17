# IFC Parser Evaluator

CLI pipeline that runs the same set of IFC files through multiple parsers
(`web-ifc`, `ifcopenshell`, `ifc-lite`), renders identical 3D screenshots from
each parser's geometry output, and produces an HTML report comparing metadata,
spatial trees, geometry counts, transform matrices, and pixel-by-pixel image
diffs across every parser pair.

Each run writes to `_ifc-output/<timestamp>/` with per-parser JSON results,
screenshots, pairwise diff images, and a generated HTML report.

## Setup

```bash
pnpm install
```

## Run

```bash
# Local mode — runs parsers directly from _external/<parser>/ via tsx / python.
pnpm start:local

# Docker mode — runs each parser inside a prebuilt image (build them first
# from docker/Dockerfile.<parser>).
pnpm start
```

Input files are listed in
[`src/cli/commands/root.command.ts`](src/cli/commands/root.command.ts). The
pipeline runs five stages: execute parsers → generate screenshots → compare
JSON results → compare images → generate report.

## Configuration

### Vertex-duplicate spheres

The 3D renderer overlays a red sphere on every unique vertex position; the
sphere radius scales with the number of times that `(x, y, z)` is duplicated,
so visually heavier spots indicate vertex-duplication hot spots. Two
screenshot variants are emitted per view: `<view>.png` (clean) and
`<view>--spheres.png` (with the heatmap). The HTML report ships a checkbox
that toggles between them at view time.

To tune the sphere size, edit `VERTEX_SPHERE_SIZE` in
[`src/geometry-renderer/public/index.ts`](src/geometry-renderer/public/index.ts).
The constant lives near the top of the file alongside `BACKGROUND_COLOR`.
Increase it to make duplicates more visible, decrease it for tight
geometries. Color is controlled by `VERTEX_SPHERE_COLOR` in the same place.

After tuning, rebuild the renderer:

```bash
pnpm build:renderer
```

## Tests

```bash
pnpm test
```
