#!/bin/bash
[ ! -d ./node_modules ] && npm i || echo 'Node modules already installed'

npm start -- --ifcFiles="$1" --outputDir="$2"
