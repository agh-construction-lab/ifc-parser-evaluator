#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="$(pwd)/.conda_env"

# udostępnij 'conda activate' w tym (nieinteraktywnym) bashu
source "$(conda info --base)/etc/profile.d/conda.sh"
# alternatywnie: eval "$(conda shell.bash hook)"

if [ ! -d "$ENV_DIR" ]; then
  echo "Creating conda environment..."
  conda create -y -p "$ENV_DIR" python=3.13
fi

conda activate "$ENV_DIR"

if [ -f "requirements.txt" ]; then
  python -m pip install -r requirements.txt -q
fi

python main.py --ifcFiles="$1" --outputDir="$2"
