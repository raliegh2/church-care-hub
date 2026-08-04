export interface MemberImportRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  ministry: string;
  joined_date: string | null;
}

export const MAX_IMPORT_ROWS = 1_000;
export const MAX_IMPORT_COLUMNS = 32;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

const MAX_ZIP_ENTRY_BYTES = 12 * 1024 * 1024;
const decoder = new TextDecoder('utf-8');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
      if (row.length > MAX_IMPORT_COLUMNS) throw new Error('The spreadsheet contains too many columns.');
    } else if (character === '\n') {
      row.push(field);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error(`Imports are limited to ${MAX_IMPORT_ROWS} member rows.`);
      row = [];
      field = '';
    } else if (character !== '\r') field += character;
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('The Excel file is not a valid XLSX archive.');
}

function listZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const end = findEndOfCentralDirectory(view);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The Excel file directory is damaged.');
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replace(/^\/+/, '');
    const uncompressedSize = view.getUint32(offset + 24, true);
    if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw new Error('The Excel file expands beyond the allowed size.');
    entries.push({
      name,
      compression: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize,
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > view.byteLength || view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error('The Excel file contains an invalid worksheet entry.');
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);

  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8 || typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot safely read compressed Excel files. Use CSV instead.');
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
  if (inflated.byteLength > MAX_ZIP_ENTRY_BYTES) throw new Error('The Excel worksheet is too large.');
  return inflated;
}

function parseXml(bytes: Uint8Array, label: string): Document {
  const document = new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`The Excel ${label} XML is invalid.`);
  return document;
}

function normalizeWorksheetPath(target: string): string {
  const clean = target.replace(/^\/+/, '');
  if (clean.startsWith('xl/')) return clean;
  return `xl/${clean.replace(/^\.\//, '')}`;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const entries = listZipEntries(buffer);
  const byName = new Map(entries.map(entry => [entry.name, entry]));
  const read = async (name: string): Promise<Uint8Array> => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`The Excel file is missing ${name}.`);
    return inflateEntry(buffer, entry);
  };

  const workbook = parseXml(await read('xl/workbook.xml'), 'workbook');
  const relationships = parseXml(await read('xl/_rels/workbook.xml.rels'), 'relationship');
  const firstSheet = workbook.getElementsByTagName('sheet')[0];
  if (!firstSheet) throw new Error('The Excel workbook does not contain a worksheet.');
  const relationshipId = firstSheet.getAttribute('r:id') || firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const relationship = Array.from(relationships.getElementsByTagName('Relationship'))
    .find(node => node.getAttribute('Id') === relationshipId);
  const target = relationship?.getAttribute('Target');
  if (!target) throw new Error('The first Excel worksheet could not be located.');

  let sharedStrings: string[] = [];
  if (byName.has('xl/sharedStrings.xml')) {
    const shared = parseXml(await read('xl/sharedStrings.xml'), 'shared strings');
    sharedStrings = Array.from(shared.getElementsByTagName('si')).map(item =>
      Array.from(item.getElementsByTagName('t')).map(text => text.textContent || '').join(''),
    );
  }

  const worksheet = parseXml(await read(normalizeWorksheetPath(target)), 'worksheet');
  const rows: string[][] = [];
  for (const rowNode of Array.from(worksheet.getElementsByTagName('row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const index = columnIndex(cell.getAttribute('r') || '');
      if (index >= MAX_IMPORT_COLUMNS) throw new Error(`Excel files are limited to ${MAX_IMPORT_COLUMNS} columns.`);
      const type = cell.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') value = Array.from(cell.getElementsByTagName('t')).map(node => node.textContent || '').join('');
      else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent || '';
        if (type === 's') value = sharedStrings[Number(raw)] || '';
        else if (type === 'b') value = raw === '1' ? 'true' : 'false';
        else value = raw;
      }
      row[index] = value;
    }
    if (row.some(value => String(value || '').trim() !== '')) rows.push(row.map(value => String(value || '')));
    if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error(`Imports are limited to ${MAX_IMPORT_ROWS} member rows.`);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function clean(value: string, maximumLength: number): string {
  return value.replace(/\0/g, '').trim().slice(0, maximumLength);
}

function normalizeDate(value: string): string | null {
  const cleaned = clean(value, 32);
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const serial = Number(cleaned);
    if (serial > 0 && serial < 100_000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
      return date.toISOString().slice(0, 10);
    }
  }
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function mapRows(rows: string[][]): MemberImportRow[] {
  if (rows.length < 2) throw new Error('The file must contain a header row and at least one member row.');
  const headers = rows[0].map(normalizeHeader);
  const column = (names: string[]) => headers.findIndex(header => names.includes(header));
  const indexes = {
    firstName: column(['first_name', 'firstname', 'first']),
    lastName: column(['last_name', 'lastname', 'last', 'surname']),
    fullName: column(['full_name', 'name']),
    email: column(['email', 'email_address']),
    phone: column(['phone', 'phone_number', 'mobile', 'cell']),
    address: column(['address', 'street_address']),
    ministry: column(['ministry', 'department']),
    joinedDate: column(['date_joined', 'joined_date', 'membership_date']),
  };
  if (indexes.firstName < 0 && indexes.fullName < 0) throw new Error('Add a First Name column, or a Full Name column.');

  const mapped = rows.slice(1).map(values => {
    let firstName = indexes.firstName >= 0 ? clean(values[indexes.firstName] || '', 100) : '';
    let lastName = indexes.lastName >= 0 ? clean(values[indexes.lastName] || '', 100) : '';
    if (!firstName && indexes.fullName >= 0) {
      const parts = clean(values[indexes.fullName] || '', 200).split(/\s+/).filter(Boolean);
      firstName = parts.shift() || '';
      lastName = parts.join(' ') || 'Unknown';
    }
    return {
      first_name: firstName,
      last_name: lastName || 'Unknown',
      email: indexes.email >= 0 ? clean(values[indexes.email] || '', 254).toLowerCase() : '',
      phone: indexes.phone >= 0 ? clean(values[indexes.phone] || '', 50) : '',
      address: indexes.address >= 0 ? clean(values[indexes.address] || '', 500) : '',
      ministry: indexes.ministry >= 0 ? clean(values[indexes.ministry] || '', 100) : '',
      joined_date: indexes.joinedDate >= 0 ? normalizeDate(values[indexes.joinedDate] || '') : null,
    };
  }).filter(row => row.first_name);

  const seen = new Set<string>();
  return mapped.filter(row => {
    const key = row.email || row.phone.replace(/\D/g, '') || `${row.first_name}|${row.last_name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function readMemberSpreadsheet(file: File): Promise<MemberImportRow[]> {
  if (file.size === 0 || file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Spreadsheet files must be larger than 0 bytes and no more than 5 MB.');
  }
  const lowerName = file.name.toLowerCase();
  let rows: string[][];
  if (lowerName.endsWith('.csv')) rows = parseCsv(await file.text());
  else if (lowerName.endsWith('.xlsx')) rows = await parseXlsx(await file.arrayBuffer());
  else throw new Error('Choose a CSV or modern Excel .xlsx file.');

  const mapped = mapRows(rows);
  if (mapped.length === 0) throw new Error('No valid member rows were found.');
  return mapped;
}
