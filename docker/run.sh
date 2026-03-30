#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Building parser images..."
docker build -t ifc-web-ifc      -f "${SCRIPT_DIR}/Dockerfile.web-ifc"      "${PROJECT_ROOT}"
docker build -t ifc-ifc-lite     -f "${SCRIPT_DIR}/Dockerfile.ifc-lite"     "${PROJECT_ROOT}"
docker build -t ifc-ifcopenshell -f "${SCRIPT_DIR}/Dockerfile.ifcopenshell" "${PROJECT_ROOT}"

echo "Running evaluator..."
HOST_PROJECT_ROOT="${PROJECT_ROOT}" docker compose -f "${SCRIPT_DIR}/docker-compose.yml" run --rm evaluator
