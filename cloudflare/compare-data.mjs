import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const catalog = JSON.parse(readFileSync('cloudflare/source-catalog.json','utf8')).catalog;
const source = JSON.parse(readFileSync('.migration/fresh-source-data.json','utf8'));
const target = JSON.parse(readFileSync('.migration/current-d1-data.json','utf8'));
const canonical = value => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])) : value);
const counts = {};
for (const [index,table] of catalog.entries()) {
  if (['auth_login_rate_limits','keepalive'].includes(table.table)) continue;
  const rows = target[index].results;
  const original = source[table.table];
  assert.equal(rows.length,original.length,`Row count: ${table.table}`);
  counts[table.table]=rows.length;
  const primary = table.constraints.find(c=>c.kind==='p').definition.match(/\(([^)]+)\)/)[1].split(',').map(k=>k.trim().replaceAll('"',''));
  const key = row => JSON.stringify(primary.map(k=>row[k]));
  const actual = new Map(rows.map(row=>[key(row),row]));
  for (const row of original) {
    const copied = actual.get(key(row)); assert.ok(copied,`Missing row: ${table.table}`);
    for (const column of table.columns.filter(c=>c.generated!=='ALWAYS')) {
      let expected = row[column.name];
      if (typeof expected === 'boolean') expected=Number(expected);
      if (expected && typeof expected === 'object') expected=JSON.stringify(expected);
      assert.equal(canonical(copied[column.name]),canonical(expected),`Value: ${table.table}.${column.name}`);
    }
  }
}
writeFileSync('.migration/latest-data-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),counts,valueComparison:'passed'},null,2));
console.log('Current application data matches Supabase exactly:',Object.values(counts).reduce((a,b)=>a+b,0),'records across',Object.keys(counts).length,'tables.');
