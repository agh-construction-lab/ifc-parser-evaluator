#!/bin/bash
# Create Node.js-compatible shim for wasm-bindgen-rayon worker helpers.
# The @ifc-lite/wasm package imports workerHelpers.js for browser Web Workers,
# which doesn't exist in the npm package. This shim provides a no-op fallback
# that runs geometry processing single-threaded in Node.js.

SNIPPETS_DIR="node_modules/@ifc-lite/wasm/pkg/snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src"

mkdir -p "$SNIPPETS_DIR"

cat > "$SNIPPETS_DIR/workerHelpers.js" << 'EOF'
// Node.js shim for wasm-bindgen-rayon workerHelpers
// Runs single-threaded - no Web Workers in Node.js
export function startWorkers(module, memory, builder) {
  builder.build();
  return Promise.resolve();
}
EOF

echo "Patched wasm-bindgen-rayon workerHelpers for Node.js"
