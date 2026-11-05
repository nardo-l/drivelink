#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const roots = ['src', 'public', 'supabase', '.github'];
const rootFiles = ['index.html', 'metadata.json'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json', '.sql', '.yml', '.yaml', '.md']);
const exceptions = new Set([
  // Add a narrowly scoped "path:line:character" exception only for an intentional,
  // non-UI literal that cannot be removed. Keep this list empty by default.
]);
const emojiPattern = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2})/gu;

async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (extensions.has(extname(entry.name))) files.push(full);
  }
  return files;
}

const files = [...rootFiles, ...(await Promise.all(roots.map(async root => {
  try { return await collect(root); } catch { return []; }
}))).flat()];
const violations = [];
for (const file of files) {
  let content;
  try { content = await readFile(file, 'utf8'); } catch { continue; }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(emojiPattern)) {
      const key = `${relative(process.cwd(), file)}:${index + 1}:${match[0]}`;
      if (!exceptions.has(key)) violations.push(key);
    }
  });
}
if (violations.length) {
  console.error('Emoji characters are not allowed in app source:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('Emoji check passed.');
