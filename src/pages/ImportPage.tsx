import { useState } from 'react';
import { FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { organizationId, supabase } from '../lib/supabase';
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  readMemberSpreadsheet,
  type MemberImportRow,
} from '../lib/memberSpreadsheet';

const INSERT_BATCH_SIZE = 200;

export function ImportPage({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MemberImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function choose(file: File) {
    setRows([]);
    setFileName(file.name);
    setMessage('Reading and validating the spreadsheet…');
    setIsError(false);

    try {
      const parsedRows = await readMemberSpreadsheet(file);
      setRows(parsedRows);
      setMessage(`${parsedRows.length} unique member rows passed validation and are ready to import.`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'The spreadsheet could not be read.');
    }
  }

  async function upload() {
    if (busy || rows.length === 0) return;
    setBusy(true);
    setMessage('Importing member records…');
    setIsError(false);

    const batchId = crypto.randomUUID();
    let imported = 0;
    for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
      const batch = rows.slice(index, index + INSERT_BATCH_SIZE).map(row => ({
        ...row,
        organization_id: organizationId,
        created_by: userId,
        import_batch_id: batchId,
        imported_at: new Date().toISOString(),
        active: true,
      }));
      const { error } = await supabase.from('members').insert(batch);
      if (error) {
        setBusy(false);
        setIsError(true);
        setMessage(`Imported ${imported} members before the database rejected a batch. ${error.message}`);
        return;
      }
      imported += batch.length;
      setMessage(`Imported ${imported} of ${rows.length} members…`);
    }

    setBusy(false);
    setRows([]);
    setFileName('');
    setMessage(`Imported ${imported} members into the shared member database.`);
  }

  return (
    <section className="import-workspace">
      <article className="panel import-card">
        <FileSpreadsheet size={46} />
        <h2>Import the member database</h2>
        <p>
          Pastors and administrators can upload a CSV or modern Excel workbook. The first worksheet should contain
          First Name and Last Name columns, or one Full Name column. Optional columns include Email, Phone, Address,
          Ministry and Date Joined.
        </p>
        <div className="import-limits">
          <span><ShieldCheck size={16} /> Local validation before upload</span>
          <span>Up to {MAX_IMPORT_ROWS.toLocaleString()} rows</span>
          <span>Up to {Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)} MB</span>
        </div>
        {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}
        <label className="file-button">
          <Upload /> Choose CSV or Excel file
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void choose(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </article>

      {rows.length > 0 && (
        <article className="panel import-preview">
          <div className="section-heading">
            <div>
              <h2>Import preview</h2>
              <p>{fileName} · {rows.length} validated rows</p>
            </div>
            <button className="primary" disabled={busy} onClick={() => void upload()}>
              {busy ? 'Importing…' : `Import ${rows.length} members`}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Ministry</th><th>Date joined</th></tr></thead>
              <tbody>
                {rows.slice(0, 25).map((row, index) => (
                  <tr key={`${row.email || row.phone || row.first_name}-${index}`}>
                    <td>{row.first_name} {row.last_name}</td>
                    <td>{row.email || '—'}</td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.ministry || '—'}</td>
                    <td>{row.joined_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 25 && <p className="muted-copy">Showing the first 25 validated rows.</p>}
        </article>
      )}
    </section>
  );
}
