'use strict';

// Small self-contained check for the HSV->RGB conversion used by the cloud color command.
// Run with `npm run selftest`.

const { hsvToRgb } = require('../src/color');

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra || ''); }
  else { fail++; console.log('  ✗', name, extra || ''); }
};

check('HSV red -> (255,0,0)', eq(hsvToRgb(0, 100, 100), [255, 0, 0]));
check('HSV green -> (0,255,0)', eq(hsvToRgb(120, 100, 100), [0, 255, 0]));
check('HSV blue -> (0,0,255)', eq(hsvToRgb(240, 100, 100), [0, 0, 255]));
check('HSV saturation 0 -> white', eq(hsvToRgb(0, 0, 100), [255, 255, 255]));
check('HSV value 0 -> black', eq(hsvToRgb(200, 100, 0), [0, 0, 0]));
check('50% value halves the peak channel', hsvToRgb(0, 100, 50)[0] === 128);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
