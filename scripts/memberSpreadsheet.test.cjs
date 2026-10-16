const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const zlib=require('node:zlib');
const compiled=ts.transpileModule(fs.readFileSync('src/lib/memberSpreadsheet.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={}; new Function('exports',compiled+'\nexports.inflateEntry=inflateEntry;')(api);
function entry(bytes) {
  const compressed=zlib.deflateRawSync(bytes), buffer=new ArrayBuffer(30+compressed.length);
  new DataView(buffer).setUint32(0,0x04034b50,true);
  new Uint8Array(buffer).set(compressed,30);
  return [buffer,{name:'xl/worksheets/sheet1.xml',compression:8,compressedSize:compressed.length,uncompressedSize:1,localHeaderOffset:0}];
}
test('ordinary compressed worksheet bytes retain their content',async()=>{
  const value=Buffer.from('<worksheet><sheetData>ordinary member data</sheetData></worksheet>');
  assert.equal(new TextDecoder().decode(await api.inflateEntry(...entry(value))),value.toString());
});
test('forged ZIP size metadata cannot bypass the actual decompression limit',async()=>{
  await assert.rejects(api.inflateEntry(...entry(Buffer.alloc(13*1024*1024,65))),/worksheet is too large/);
});
test('ordinary CSV member imports still parse headers, quoted values and records',async()=>{
  const file=new File(['first_name,last_name,email\nJane,"Example, Jr.",jane@example.test\n'],'members.csv',{type:'text/csv'});
  const rows=await api.readMemberSpreadsheet(file);
  assert.equal(rows.length,1); assert.equal(rows[0].first_name,'Jane'); assert.equal(rows[0].last_name,'Example, Jr.');
});
