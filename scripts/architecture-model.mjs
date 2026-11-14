import { readFile, writeFile } from 'node:fs/promises';
const model = JSON.parse(await readFile(new URL('../src/architecture/catalog.json', import.meta.url)));
const q = value => JSON.stringify(value);
const lines = ['// Generated from src/architecture/catalog.json. Public-safe content only.', 'specification {', '  element system', '  tag current', '  tag planned', '  tag unverified', '}', 'model {'];
function element(node, indent = '  ') {
  lines.push(`${indent}${node.id.split('.').at(-1)} = system ${q(node.title)} {`, `${indent}  #${node.status}`, `${indent}  description ${q(`${node.status.toUpperCase()}: ${node.purpose} ${node.usage}`)}`, `${indent}  link ${node.source} "Source / evidence limits"`, `${indent}  metadata {`, `${indent}    status ${q(node.status)}`, `${indent}    owner ${q(model.owner)}`, `${indent}    review ${q(model.reviewed)}`, `${indent}  }`, `${indent}  style { color ${node.status === 'planned' ? 'amber' : node.status === 'current' ? 'green' : 'slate'} }`);
  for (const child of model.nodes.filter(n => n.parent === node.id)) element(child, `${indent}  `);
  lines.push(`${indent}}`);
}
for (const node of model.nodes.filter(n => !n.parent)) element(node);
for (const edge of model.edges) lines.push(`  ${edge.source} -> ${edge.target} ${q(`${edge.status.toUpperCase()}: ${edge.title}`)} { #${edge.status} }`);
lines.push('}', 'views {');
for (const view of model.views) lines.push(`  view ${view.id}${view.id === 'foundation' ? ' of platform' : view.id === 'tenantBoundary' ? ' of tenant' : ''} {`, `    title ${q(view.title)}`, `    description ${q(view.summary)}`, `    include ${view.nodes.join(', ')}`, '    autoLayout LeftRight', '  }');
for (const journey of model.journeys) {
  lines.push(`  dynamic view ${journey.id}Walkthrough {`, `    title ${q(`${journey.title} · ${journey.status}`)}`);
  for (let i = 0; i < journey.steps.length - 1; i++) {
    const from = journey.steps[i], to = journey.steps[i + 1];
    if (from.node !== to.node) lines.push(`    ${from.node} -> ${to.node} ${q(`${journey.status.toUpperCase()}: ${to.title}`)}`);
  }
  lines.push('  }');
}
lines.push('}', '');
const path = new URL('../architecture/public/model.c4', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== lines.join('\n')) throw new Error('Architecture model is stale: npm run architecture:source');
} else await writeFile(path, lines.join('\n'));
