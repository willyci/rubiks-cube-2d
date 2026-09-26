import fs from 'fs';
import { execSync } from 'child_process';

console.log(`========================================`);
console.log(`  RUNNING CUBEX4 AND CUBEX5 TEST SUITE  `);
console.log(`========================================\n`);

const files = ['cubex4.html', 'cubex5.html'];
let overallSuccess = true;

for (const filename of files) {
  console.log(`▶ Testing ${filename}...`);

  if (!fs.existsSync(filename)) {
    console.error(`  ❌ File ${filename} does not exist!`);
    overallSuccess = false;
    continue;
  }

  const html = fs.readFileSync(filename, 'utf8');

  // Test 1: HTML Structure & DOM IDs
  const requiredIds = [
    'app',
    'circleControlsOverlay',
    'cubeControlsWidget',
    'methods-panel',
    'btnBackHub',
    'hud',
    'title'
  ];

  let idCheck = true;
  for (const id of requiredIds) {
    if (!html.includes(`id="${id}"`)) {
      console.error(`  ❌ Missing DOM element with id="${id}"`);
      idCheck = false;
    }
  }
  if (idCheck) {
    console.log(`  ✔ [PASS] HTML DOM elements verified`);
  } else {
    overallSuccess = false;
  }

  // Test 2: Importmap & Three.js configuration
  if (html.includes('importmap') && html.includes('three@0.169.0')) {
    console.log(`  ✔ [PASS] Three.js importmap verified`);
  } else {
    console.error(`  ❌ Importmap configuration missing or invalid`);
    overallSuccess = false;
  }

  // Test 3: Extract JS module code
  const startTag = '<script type="module">';
  const endTag = '</script>';
  const startIndex = html.indexOf(startTag);
  const endIndex = html.lastIndexOf(endTag);

  if (startIndex === -1 || endIndex === -1) {
    console.error(`  ❌ <script type="module"> tag missing!`);
    overallSuccess = false;
    continue;
  }

  const scriptCode = html.substring(startIndex + startTag.length, endIndex);
  const tempPath = `scratch/temp_${filename}.mjs`;
  fs.writeFileSync(tempPath, scriptCode, 'utf8');

  // Test 4: ES Module Syntax Validation (Node.js compile check)
  try {
    execSync(`node -c ${tempPath}`, { stdio: 'pipe' });
    console.log(`  ✔ [PASS] ES Module Syntax validated OK (${scriptCode.length} bytes, ${(scriptCode.match(/\n/g) || []).length} lines)`);
  } catch (err) {
    console.error(`  ❌ ES Module Syntax ERROR:\n`, err.stderr ? err.stderr.toString() : err.message);
    overallSuccess = false;
  }

  // Test 5: Key Classes & Engine Symbols
  const expectedSymbols = [
    'RubiksCube',
    'ThreeRingDiagram',
    'MoveEngine',
    'faceOfNormal',
    'layerSpec',
    'inLayer',
    'colorFaceOf',
    'circleIntersections',
    'calculateRestPosition',
    'window.cube'
  ];

  let symbolCheck = true;
  for (const sym of expectedSymbols) {
    if (!scriptCode.includes(sym)) {
      console.error(`  ❌ Missing JS symbol: ${sym}`);
      symbolCheck = false;
    }
  }
  if (symbolCheck) {
    console.log(`  ✔ [PASS] Core classes & engine functions present`);
  } else {
    overallSuccess = false;
  }

  // Test 6: Check Move Controls (U, D, F, B, R, L rotation buttons)
  const requiredButtons = [
    'btn-rot-U-cw', 'btn-rot-U-ccw',
    'btn-rot-D-cw', 'btn-rot-D-ccw',
    'btn-rot-F-cw', 'btn-rot-F-ccw',
    'btn-rot-B-cw', 'btn-rot-B-ccw',
    'btn-rot-R-cw', 'btn-rot-R-ccw',
    'btn-rot-L-cw', 'btn-rot-L-ccw'
  ];

  let btnCheck = true;
  for (const btnId of requiredButtons) {
    if (!html.includes(`id="${btnId}"`)) {
      console.error(`  ❌ Missing rotation control button: id="${btnId}"`);
      btnCheck = false;
    }
  }
  if (btnCheck) {
    console.log(`  ✔ [PASS] Interactive rotation buttons verified (12/12)`);
  } else {
    overallSuccess = false;
  }

  console.log(`  🏁 ${filename} test finished.\n`);
}

console.log(`========================================`);
if (overallSuccess) {
  console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY!`);
  process.exit(0);
} else {
  console.error(`💥 TEST SUITE FAILED!`);
  process.exit(1);
}
