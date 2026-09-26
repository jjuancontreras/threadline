// Prints the gzipped size of every JS chunk in dist/ and fails if the total exceeds budget.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 700;
const dir = join(process.cwd(), 'dist', 'assets');
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
let total = 0;
for (const f of files) {
  const buf = readFileSync(join(dir, f));
  const gz = gzipSync(buf, { level: 9 }).length;
  total += gz;
  console.log(`  ${f.padEnd(34)} ${(statSync(join(dir, f)).size / 1024).toFixed(1).padStart(8)} KB raw  ${(gz / 1024).toFixed(1).padStart(7)} KB gzip`);
}
console.log(`JS gzip total (fonts excluded): ${(total / 1024).toFixed(1)} KB / budget ${BUDGET_KB} KB`);
if (total / 1024 > BUDGET_KB) {
  console.error('Bundle over budget');
  process.exit(1);
}
