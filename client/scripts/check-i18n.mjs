import fs from 'node:fs';
import path from 'node:path';
import { dict } from '../src/lib/dict.js';

const langs = Object.keys(dict);
let bad = 0;
const all = new Set(langs.flatMap((l) => Object.keys(dict[l])));
for (const l of langs) for (const k of all) if (!(k in dict[l])) { console.log(`MISSING [${l}] ${k}`); bad++; }

// keys used in source via t('...') must exist
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk('src').filter((f) => /\.jsx?$/.test(f) && !f.endsWith('dict.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) if (!all.has(m[1])) { console.log(`UNDEFINED key ${m[1]} in ${f}`); bad++; }
}
console.log(bad ? `${bad} problem(s)` : `i18n OK (${all.size} keys x ${langs.length} languages)`);
process.exit(bad ? 1 : 0);
