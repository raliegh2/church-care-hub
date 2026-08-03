import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { organizationId, supabase } from '../lib/supabase';

interface ImportRow {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  ministry?: string;
  joined_date?: string;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1_000;
const MAX_COLUMNS = 32;

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

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
      if (row.length > MAX_COLUMNS) throw new Error('The CSV contains too many columns.');
    } else if (character === '\n') {
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      if (rows.length > MAX_ROWS + 1) throw new Error(`CSV files are limited to ${MAX_ROWS} member rows.`);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (rows.length > MAX_ROWS + 1) throw new Error(`CSV files are limited to ${MAX_ROWS} member rows.`);
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clean(value: string, maximumLength: number): string {
  return value.replace(/\0/g, '').trim().slice(0, maximumLength);
}

function mapRows(csvRows: string[][]): ImportRow[] {
  if (csvRows.length < 2) throw new Error('The CSV must include a header row and at least one member row.');

  const headers = csvRows[0].map(normalizeHeader);
  const column = (names: string[]): number => headers.findIndex((header) => names.includes(header));
  const indexes = {
    firstName: column(['first_name', 'firstname']),
    lastName: column(['last_name', 'lastname']),
    email: column(['email', 'email_address']),
    phone: column(['phone', 'phone_number', 'mobile']),
    address: column(['address', 'street_address']),
    ministry: column(['ministry']),
    joinedDate: column(['date_joined', 'joined_date']),
  };

  if (indexes.firstName < 0 || indexes.lastName < 0) {
    throw new Error('The CSV must contain First Name and Last Name columns.');
  }

  return csvRows.slice(1).map((values) => ({
    first_name: clean(values[indexes.firstName] || '', 100),
    last_name: clean(values[indexes.lastName] || '', 100),
    email: indexes.email >= 0 ? clean(values[indexes.email] || '', 254) : '',
    phone: indexes.phone >= 0 ? clean(values[indexes.phone] || '', 50) : '',
    address: indexes.address >= 0 ? clean(values[indexes.address] || '', 500) : '',
    ministry: indexes.ministry >= 0 ? clean(values[indexes.ministry] || '', 100) : '',
    joined_date: indexes.joinedDate >= 0 ? clean(values[indexes.joinedDate] || '', 32) : '',
  })).filter((row) => row.first_name || row.last_name);
}

export function ImportPage({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function choose(file: File) {
    setRows([]);
    setMessage('');
    setIsError(false);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setIsError(true);
      setMessage('For security, imports must use a CSV file. Export Excel files as CSV before uploading.');
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setIsError(true);
      setMessage('CSV files must be larger than 0 bytes and no more than 2 MB.');
      return;
    }

    try {
      const parsedRows = mapRows(parseCsv(await file.text()));
      if (parsedRows.length === 0) throw new Error('No valid member rows were found.');
      setRows(parsedRows);
      setMessage(`${parsedRows.length} rows passed validation and are ready to import.`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'The CSV could not be read.');
    }
  }

  async function upload() {
    if (busy || rows.length === 0) return;
    setBusy(true);
    setMessage('');
    setIsError(false);

    const batch = crypto.randomUUID();
    const data = rows.map((row) => ({
      ...row,
      organization_id: organizationId,
      created_by: userId,
      import_batch_id: batch,
      imported_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('members').insert(data);
    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage('The import was rejected. Confirm the file values and your account permissions, then try again.');
      return;
    }

    setMessage(`Imported ${rows.length} members.`);
    setRows([]);
  }

  return <article className="panel import-card"><FileSpreadsheet size={44}/><h2>Import member database</h2><p>Upload a CSV file with First Name, Last Name, Email, Phone, Address, Ministry and Date Joined columns. Files are limited to 2 MB and 1,000 member rows.</p>{message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}<label className="file-button"><Upload/> Choose CSV file<input type="file" accept=".csv,text/csv" onChange={event => { const file = event.target.files?.[0]; if (file) void choose(file); event.currentTarget.value = ''; }}/></label>{rows.length > 0 && <div className="import-preview"><strong>{rows.length} rows ready</strong><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Ministry</th></tr></thead><tbody>{rows.slice(0, 12).map((row, index) => <tr key={`${row.email || row.phone || row.first_name}-${index}`}><td>{row.first_name} {row.last_name}</td><td>{row.email}</td><td>{row.phone}</td><td>{row.ministry}</td></tr>)}</tbody></table></div><button className="primary" disabled={busy} onClick={() => void upload()}>{busy ? 'Importing…' : `Import ${rows.length} members`}</button></div>}</article>;
}
