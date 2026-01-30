#!/bin/bash

if [ ! -d "./.conda_env" ]; then
    echo "Creating conda environment..."
    conda create --prefix ./.conda_env python=3.13 -y
fi

source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate ./.conda_env

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt -q
fi

python main.py --ifcFiles="$1" --outputDir="$2"
