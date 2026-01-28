import { executeCommand } from './_original/core/executeCommand.js';
import { getInputFilesPaths } from './_original/core/pathUtils.js';
import { compareResults } from './results-comparer/index.ts';

const inputFilesPaths = getInputFilesPaths();

const RUN_WEBIFC_PARSER: boolean = true;
// const RUN_WEBIFC_PARSER: boolean = false;
const RUN_IFCOPENSHELL_PARSER: boolean = true;
// const RUN_IFCOPENSHELL_PARSER: boolean = false;
const RUN_RESULTS_COMPARER: boolean = true;
// const RUN_RESULTS_COMPARER: boolean = false;

const SEPARATOR = '~~~~~~~~~~~~~~~~~~~~';

console.log('\n', SEPARATOR, '\n');

if (RUN_WEBIFC_PARSER) {
  console.log('Running web-ifc');
  executeCommand([
    'cd parsers/web-ifc',
    "[ ! -d ./node_modules ] && npm i || echo 'Node modules already installed'",
    `npm start -- --ifcFiles=${inputFilesPaths}`,
  ]);
} else {
  console.log('Skipping web-ifc');
}

console.log('\n', SEPARATOR, '\n');

if (RUN_IFCOPENSHELL_PARSER) {
  console.log('Running IfcOpenShell');
  executeCommand([
    'cd ./parsers/ifcopenshell',
    "[ ! -d ./.conda_env ] && conda env create --prefix ./.conda_env -f environment.yml || echo 'Conda environment already exists'",
    `conda run --prefix ./.conda_env python main.py ${inputFilesPaths}`,
  ]);
} else {
  console.log('Skipping IfcOpenShell parser');
}

console.log('\n', SEPARATOR, '\n');

if (RUN_RESULTS_COMPARER) {
  compareResults();
}
