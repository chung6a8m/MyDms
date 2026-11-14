import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const license = read('LICENSE');
const terms = ['MIT License','Copyright (c) 2026 chung6a8m','Permission is hereby granted, free of charge','The above copyright notice and this permission notice shall be included','THE SOFTWARE IS PROVIDED "AS IS"','IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE'];
const normalizedLicense = license.replace(/\s+/g, ' ');
for(const s of terms) if (!normalizedLicense.includes(s)) throw Error('Incomplete MIT license: '+s);
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
if(pkg.license!=='MIT' || lock.packages[''].license!=='MIT') throw Error('npm MIT metadata mismatch');
if(pkg.private!==true) throw Error('npm publication must remain disabled');
for(const name of ['README.md','AGENTS.md','NOTICE.md']){
  const t=read(name);
  if(!t.includes('MIT')) throw Error('Missing MIT reference: '+name);
  if(/Private, proprietary Product DMS|private, proprietary commercial software|No license to redistribute|must remain `private`/i.test(t)) throw Error('Superseded proprietary restriction: '+name);
}
if(process.argv.includes('--self-test')){
  const corrupted=license.replace('MIT License','WRONG LICENSE');
  if(terms.every(x=>corrupted.replace(/\s+/g, ' ').includes(x))) throw Error('Negative test failed');
  console.log('PASS_MIT_LICENSE_NEGATIVES 1');
}
console.log('PASS_MIT_LICENSE_CONTRACT_ONLY');
