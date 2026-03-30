#!/bin/bash
[ ! -d ./node_modules ] && npm i || echo 'Node modules already installed'

# Ensure WASM shim exists (postinstall may not have run)
bash scripts/patch-wasm.sh

npm start -- --ifcFiles="$1" --outputDir="$2"
