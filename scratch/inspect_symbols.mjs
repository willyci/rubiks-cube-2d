import fs from 'fs';

for (const file of ['cubex4.html', 'cubex5.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const startTag = '<script type="module">';
  const endTag = '</script>';
  const startIndex = html.indexOf(startTag);
  const endIndex = html.lastIndexOf(endTag);
  const code = html.substring(startIndex + startTag.length, endIndex);

  console.log(`=== ${file} ===`);
  const classMatches = code.match(/class\s+([A-Za-z0-9_]+)/g) || [];
  console.log('Classes:', classMatches);

  const funcMatches = code.match(/function\s+([A-Za-z0-9_]+)/g) || [];
  console.log('Top Functions (first 15):', funcMatches.slice(0, 15));
}
