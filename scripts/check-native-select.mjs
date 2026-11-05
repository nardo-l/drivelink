import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const componentPath = path.resolve('src/components/common/Select.tsx');
const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx|jsx)$/.test(entry.name) && path.resolve(file) !== componentPath) {
      const source = fs.readFileSync(file, 'utf8');
      const lines = source.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/<\s*select\b/i.test(line)) failures.push(`${path.relative(process.cwd(), file)}:${index + 1}: raw <select> found`);
      });
    }
  }
}

walk(root);
if (failures.length) {
  console.error('Native select elements must use the shared Select component:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('Native select check passed.');
