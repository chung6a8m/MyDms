import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const solution = fs.readFileSync(path.join(root, 'MyDms.slnx'), 'utf8');
const projects = [...solution.matchAll(/<Project Path="([^"]+\.csproj)"\s*\/>/g)].map(x => x[1]);
function norm(x) { return x.split(path.sep).join('/'); }
function classify(project) {
  if (project.includes('/Host/')) return { kind: 'Host' };
  if (project.includes('/BuildingBlocks/')) return { kind: 'BuildingBlocks' };
  if (project.includes('/Platform/')) return { kind: 'Platform' };
  if (project.includes('/tests/') || project.startsWith('tests/')) return { kind: 'Tests' };
  const m = project.match(/\/Modules\/([^/]+)\/(Domain|Application|Infrastructure)\//);
  if (m) return { kind: m[2], module: m[1] };
  throw Error('Unknown source boundary: ' + project);
}
function allowed(from, to) {
  const a = classify(from), b = classify(to);
  if (a.kind === 'Tests') return true;
  if (a.kind === 'BuildingBlocks') return false;
  if (a.kind === 'Host') return b.kind === 'Infrastructure' || b.kind === 'Platform';
  if (a.kind === 'Platform') return b.kind === 'BuildingBlocks';
  if (a.kind === 'Domain') return b.kind === 'BuildingBlocks';
  if (a.kind === 'Application') return b.kind === 'BuildingBlocks' || (b.kind === 'Domain' && a.module === b.module);
  if (a.kind === 'Infrastructure') return b.kind === 'BuildingBlocks' || (b.module === a.module && ['Domain', 'Application'].includes(b.kind));
  return false;
}
const srcSet = new Set(projects.map(norm));
if (srcSet.size !== projects.length || srcSet.size === 0) throw Error('Missing or duplicate solution projects');
// Detect orphan source projects that evade .slnx-based architectural checks.
function discoverCsproj(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => {
    if (['bin', 'obj', 'node_modules'].includes(e.name)) return [];
    const full = path.join(directory, e.name);
    return e.isDirectory() ? discoverCsproj(full) : e.isFile() && e.name.endsWith('.csproj') ? [norm(path.relative(root, full))] : [];
  });
}
const discovered = [...discoverCsproj(path.join(root, 'src/server')), ...discoverCsproj(path.join(root, 'tests'))];
if (discovered.length !== srcSet.size || discovered.some(p => !srcSet.has(p)))
  throw Error('Unlisted project can evade architecture guard: ' + discovered.filter(p => !srcSet.has(p)).join(','));
for (const project of projects) {
  const csprojPath = path.join(root, project);
  if (!fs.existsSync(csprojPath)) throw Error('Missing csproj: ' + project);
  const xml = fs.readFileSync(csprojPath, 'utf8');
  for (const match of xml.matchAll(/<ProjectReference Include="([^"]+)"\s*\/>/g)) {
    const resolved = norm(path.relative(root, path.resolve(path.dirname(csprojPath), match[1].replaceAll('\\','/'))));
    if (!srcSet.has(resolved)) throw Error('Reference outside solution: ' + project + ' -> ' + resolved);
    if (!allowed(project, resolved)) throw Error('Forbidden dependency: ' + project + ' -> ' + resolved);
  }
  if (classify(project).kind === 'Domain') {
    const dir = path.dirname(csprojPath);
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.cs'))) {
      const code = fs.readFileSync(path.join(dir, file), 'utf8');
      if (/\busing\s+(Microsoft\.AspNetCore|Microsoft\.EntityFrameworkCore|System\.Data|Microsoft\.Data\.SqlClient)\b/.test(code))
        throw Error('Domain forbidden persistence/HTTP namespace: ' + file);
    }
  }
}
if (process.argv.includes('--self-test')) {
  const invDomain = 'src/server/Modules/Inventory/Domain/MyDms.Inventory.Domain.csproj';
  const salesInfra = 'src/server/Modules/Sales/Infrastructure/MyDms.Sales.Infrastructure.csproj';
  const inventoryApp = 'src/server/Modules/Inventory/Application/MyDms.Inventory.Application.csproj';
  const host = 'src/server/Host/MyDms.Api/MyDms.Api.csproj';
  if (allowed(invDomain, salesInfra) || allowed(inventoryApp, salesInfra) || allowed(invDomain, host))
    throw Error('Negative architecture tests failed');
  console.log('PASS_ARCHITECTURE_NEGATIVES 3 (plus orphan/duplicate project detection)');
}
console.log(JSON.stringify({ result: 'PASS_ARCHITECTURE_BOUNDARIES', projectCount: projects.length, verifiedProduct: false }));
