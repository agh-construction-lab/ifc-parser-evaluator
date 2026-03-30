#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${HOST_PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
IFC_INPUT_HOST="${PROJECT_ROOT}/_ifc-input"
IFC_OUTPUT_HOST="${PROJECT_ROOT}/_ifc-output"
IFC_FILES_CTR=$(echo "$1" | sed "s|${IFC_INPUT_HOST}|/app/_ifc-input|g")
OUTPUT_DIR_CTR=$(echo "$2" | sed "s|${IFC_OUTPUT_HOST}|/app/_ifc-output|g")
docker run --rm \
  -v "${IFC_INPUT_HOST}:/app/_ifc-input:ro" \
  -v "${IFC_OUTPUT_HOST}:/app/_ifc-output" \
  "${WEB_IFC_IMAGE:-ifc-web-ifc}" \
  "${IFC_FILES_CTR}" "${OUTPUT_DIR_CTR}"
