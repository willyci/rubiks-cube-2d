import fs from 'fs';
import { execSync } from 'child_process';

const html = fs.readFileSync('cubex3.html', 'utf8');
const startTag = '<script type="module">';
const endTag = '</script>';
const startIndex = html.indexOf(startTag);
const endIndex = html.lastIndexOf(endTag);

const scriptCode = html.substring(startIndex + startTag.length, endIndex);
fs.writeFileSync('scratch/temp_cubex3_script.mjs', scriptCode, 'utf8');

try {
  execSync('node -c scratch/temp_cubex3_script.mjs', { stdio: 'pipe' });
  console.log('ES Module Syntax Validated OK!');
} catch (err) {
  console.error('Syntax validation failed:\n', err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
