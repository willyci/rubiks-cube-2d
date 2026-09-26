import fs from 'fs';
import { execSync } from 'child_process';

const files = ['cubex2.html', 'cubex3.html', 'cubex4.html', 'cubex5.html', 'cubex6.html', 'cubex7.html'].filter(f => fs.existsSync(f));
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const startTag = '<script type="module">';
  const endTag = '</script>';
  const startIndex = html.indexOf(startTag);
  const endIndex = html.lastIndexOf(endTag);
  if (startIndex === -1 || endIndex === -1) {
    console.log(`${file}: Skipped (no script tag found)`);
    continue;
  }
  const scriptCode = html.substring(startIndex + startTag.length, endIndex);
  const tempPath = `scratch/temp_${file}.mjs`;
  fs.writeFileSync(tempPath, scriptCode, 'utf8');
  try {
    execSync(`node -c ${tempPath}`, { stdio: 'pipe' });
    console.log(`${file}: Syntax OK`);
  } catch (err) {
    console.error(`${file}: Syntax ERROR:\n`, err.stderr ? err.stderr.toString() : err.message);
  }
}
