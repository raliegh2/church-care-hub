import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
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
    <section className="import-workspace redesign-import">
      <div className="import-stepper" aria-label="Member import progress">
        <span className="complete"><i>1</i><strong>Upload file</strong><small>{fileName ? 'Complete' : 'Current step'}</small></span>
        <span className={rows.length ? 'complete' : 'active'}><i>2</i><strong>Map columns</strong><small>{rows.length ? 'Auto-mapped' : 'Waiting for file'}</small></span>
        <span className={rows.length ? 'active' : ''}><i>3</i><strong>Review records</strong><small>{rows.length ? `${rows.length} ready` : 'Not started'}</small></span>
        <span><i>4</i><strong>Import</strong><small>Not started</small></span>
      </div>

      <div className="import-top-grid">
        <article className="panel import-file-card">
          <div className="panel-title-row"><div><h2>Uploaded file</h2><p>CSV or modern Excel workbook.</p></div><FileSpreadsheet size={22} /></div>
          {fileName ? (
            <div className="uploaded-file-summary">
              <span className="file-icon"><FileSpreadsheet /></span>
              <span><strong>{fileName}</strong><small>{rows.length ? `${rows.length} valid records detected` : 'Validating file…'}</small></span>
              {rows.length > 0 && <em>Ready</em>}
            </div>
          ) : (
            <label className="file-button import-dropzone">
              <Upload />
              <strong>Choose a CSV or Excel file</strong>
              <span>Up to {MAX_IMPORT_ROWS.toLocaleString()} rows and {Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)} MB</span>
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
          )}
          {fileName && (
            <label className="file-button replace-file-button">
              <Upload size={17} /> Replace file
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
          )}
        </article>

        <article className="panel column-mapping-card">
          <div className="panel-title-row"><div><h2>Column mapping</h2><p>Spreadsheet headers are matched automatically to member fields.</p></div><ShieldCheck size={22} /></div>
          <div className="mapping-list">
            <span><strong>Required</strong><small>First Name + Last Name, or Full Name</small></span>
            <span><strong>Optional</strong><small>Email, Phone, Address, Ministry, Date Joined</small></span>
            <span className={rows.length ? 'mapped' : ''}><CheckCircle2 /><small>{rows.length ? 'Headers mapped and validated' : 'Upload a file to validate its headers'}</small></span>
          </div>
        </article>
      </div>

      {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}

      {rows.length > 0 && (
        <article className="panel import-preview">
          <div className="section-heading">
            <div>
              <h2>Preview</h2>
              <p>{rows.length} validated member records are ready for review.</p>
            </div>
            <button className="primary" disabled={busy} onClick={() => void upload()}>
              {busy ? 'Importing…' : `Import ${rows.length} members`}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Ministry</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 25).map((row, index) => (
                  <tr key={`${row.email || row.phone || row.first_name}-${index}`}>
                    <td><strong>{row.first_name} {row.last_name}</strong></td>
                    <td>{row.email || '—'}</td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.ministry || '—'}</td>
                    <td><span className="table-status ready">Ready</span></td>
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
