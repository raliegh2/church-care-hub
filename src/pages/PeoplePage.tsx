import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Edit3,
  MapPin,
  Plus,
  Search,
  StickyNote,
  UserRoundCheck,
} from 'lucide-react';
import { organizationId, supabase } from '../lib/supabase';
import type { AppRole, CareNote, Member, VisitRecord, Visitor } from '../types';

type Person = Visitor | Member;
type PersonType = 'visitor' | 'member';

function localDateTimeValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function personName(type: PersonType, person: Person): string {
  return type === 'visitor'
    ? (person as Visitor).full_name
    : `${(person as Member).first_name} ${(person as Member).last_name}`;
}

function personContact(type: PersonType, person: Person): string {
  if (type === 'visitor') return (person as Visitor).optional_contact || 'No contact recorded';
  const member = person as Member;
  return member.phone || member.email || 'No contact recorded';
}

export function PeoplePage({ type, userId, role }: { type: PersonType; userId: string; role: AppRole }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<CareNote[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const selected = people.find(person => person.id === selectedId) || null;

  const loadPeople = useCallback(async () => {
    const table = type === 'visitor' ? 'visitors' : 'members';
    const { data, error } = await supabase.from(table).select('*').eq('active', true).order('created_at', { ascending: false }).limit(1_000);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    const next = (data || []) as Person[];
    setPeople(next);
    setSelectedId(current => current && next.some(person => person.id === current) ? current : next[0]?.id || null);
  }, [type]);

  const loadCareRecord = useCallback(async (personId: string | null) => {
    if (!personId) {
      setNotes([]);
      setVisits([]);
      return;
    }
    const key = type === 'visitor' ? 'visitor_id' : 'member_id';
    const [notesResult, visitsResult] = await Promise.all([
      supabase.from('care_notes').select('*').eq(key, personId).order('created_at', { ascending: false }),
      supabase.from('visit_records').select('*').eq(key, personId).order('visited_at', { ascending: false }),
    ]);
    if (notesResult.error || visitsResult.error) {
      setIsError(true);
      setMessage(notesResult.error?.message || visitsResult.error?.message || 'Unable to load the care record.');
      return;
    }
    setNotes((notesResult.data || []) as CareNote[]);
    setVisits((visitsResult.data || []) as VisitRecord[]);
  }, [type]);

  useEffect(() => { void loadPeople(); }, [loadPeople]);
  useEffect(() => { void loadCareRecord(selectedId); }, [loadCareRecord, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;
    return people.filter(person => [personName(type, person), personContact(type, person), JSON.stringify(person)]
      .join(' ')
      .toLowerCase()
      .includes(normalized));
  }, [people, query, type]);

  async function addNote(text: string, noteType: string) {
    if (!selected || !text.trim()) return;
    const key = type === 'visitor' ? 'visitor_id' : 'member_id';
    const { error } = await supabase.from('care_notes').insert({
      organization_id: organizationId,
      [key]: selected.id,
      note_text: text.trim(),
      note_type: noteType,
      status: 'open',
      visibility: type === 'visitor' ? 'assigned_team' : 'pastoral_team',
      created_by: userId,
    });
    setIsError(Boolean(error));
    setMessage(error ? error.message : 'Support note saved.');
    if (!error) await loadCareRecord(selected.id);
  }

  async function resolveNote(note: CareNote) {
    const nextStatus = note.status === 'resolved' ? 'open' : 'resolved';
    const { error } = await supabase.from('care_notes').update({
      status: nextStatus,
      resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', note.id);
    setIsError(Boolean(error));
    setMessage(error ? error.message : `Note marked ${nextStatus}.`);
    if (!error && selected) await loadCareRecord(selected.id);
  }

  async function recordVisit(visitedAt: string, outcome: string, summary: string) {
    if (!selected) return;
    const key = type === 'visitor' ? 'visitor_id' : 'member_id';
    const visitTimestamp = new Date(visitedAt);
    if (Number.isNaN(visitTimestamp.getTime())) {
      setIsError(true);
      setMessage('Choose a valid visit date and time.');
      return;
    }
    const { error } = await supabase.from('visit_records').insert({
      organization_id: organizationId,
      [key]: selected.id,
      visited_at: visitTimestamp.toISOString(),
      visited_by: userId,
      outcome,
      summary: summary.trim() || null,
    });
    if (!error && type === 'member') {
      await supabase.from('members').update({ last_contact_at: visitTimestamp.toISOString() }).eq('id', selected.id);
    }
    setIsError(Boolean(error));
    setMessage(error ? error.message : 'Visit recorded in the shared care history.');
    if (!error) await loadCareRecord(selected.id);
  }

  return (
    <>
      {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}
      <section className="people-layout care-people-layout">
        <article className="panel people-list">
          <div className="section-heading">
            <div>
              <h2>{type === 'visitor' ? 'Visitor' : 'Member'} database</h2>
              <p>{type === 'visitor' ? 'Shared by ushers, pastors and administrators.' : 'Shared by pastors and administrators.'}</p>
            </div>
            <button className="primary" onClick={() => setEditing(null)}><Plus size={18} /> Add</button>
          </div>
          <label className="search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or contact" /></label>
          <div className="rows person-rows">
            {filtered.map(person => {
              const isSelected = selectedId === person.id;
              return (
                <button key={person.id} className={isSelected ? 'selected' : ''} onClick={() => setSelectedId(person.id)}>
                  <span><strong>{personName(type, person)}</strong><small>{personContact(type, person)}</small></span>
                  <span className="row-chevron">›</span>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="empty compact-empty">No matching records.</div>}
          </div>
        </article>

        <article className="panel person-detail">
          {selected ? (
            <PersonDetail
              type={type}
              role={role}
              person={selected}
              notes={notes}
              visits={visits}
              onEdit={() => setEditing(selected)}
              onNote={addNote}
              onResolveNote={resolveNote}
              onVisit={recordVisit}
            />
          ) : <div className="empty">Add or select a {type} to review visits and support needs.</div>}
        </article>
      </section>

      {editing !== undefined && (
        <PersonForm
          type={type}
          person={editing}
          userId={userId}
          close={() => setEditing(undefined)}
          done={async personId => {
            setEditing(undefined);
            await loadPeople();
            if (personId) setSelectedId(personId);
          }}
        />
      )}
    </>
  );
}

function PersonDetail({
  type,
  role,
  person,
  notes,
  visits,
  onEdit,
  onNote,
  onResolveNote,
  onVisit,
}: {
  type: PersonType;
  role: AppRole;
  person: Person;
  notes: CareNote[];
  visits: VisitRecord[];
  onEdit: () => void;
  onNote: (text: string, noteType: string) => Promise<void>;
  onResolveNote: (note: CareNote) => Promise<void>;
  onVisit: (visitedAt: string, outcome: string, summary: string) => Promise<void>;
}) {
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('support');
  const [visitedAt, setVisitedAt] = useState(localDateTimeValue());
  const [outcome, setOutcome] = useState('completed');
  const [visitSummary, setVisitSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const member = type === 'member' ? person as Member : null;
  const visitor = type === 'visitor' ? person as Visitor : null;
  const lastVisit = visits[0];
  const openNotes = notes.filter(note => note.status !== 'resolved').length;

  useEffect(() => {
    setNoteText('');
    setVisitSummary('');
    setVisitedAt(localDateTimeValue());
  }, [person.id]);

  return (
    <div className="care-record">
      <div className="section-heading person-heading">
        <div>
          <div className="eyebrow">{type === 'visitor' ? 'Visitor care record' : 'Member care record'}</div>
          <h2>{personName(type, person)}</h2>
          <p>{personContact(type, person)}</p>
        </div>
        <button className="secondary" onClick={onEdit}><Edit3 size={17} /> Edit</button>
      </div>

      <div className="care-status-grid">
        <article className={visits.length ? 'status-card visited' : 'status-card'}>
          {visits.length ? <CheckCircle2 /> : <CircleDashed />}
          <span>{visits.length ? 'Visited' : 'Not visited yet'}</span>
          <strong>{visits.length}</strong>
          <small>{lastVisit ? `Last: ${new Date(lastVisit.visited_at).toLocaleDateString()}` : 'No visit recorded'}</small>
        </article>
        <article className="status-card">
          <StickyNote />
          <span>Open support needs</span>
          <strong>{openNotes}</strong>
          <small>{notes.length} total care notes</small>
        </article>
      </div>

      <div className="person-facts">
        {member?.address && <span><MapPin size={16} /> {member.address}</span>}
        {member?.ministry && <span>Ministry: {member.ministry}</span>}
        {member?.birth_date && <span>Birthday: {new Date(`${member.birth_date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>}
        {member?.joined_date && <span>Joined: {new Date(`${member.joined_date}T00:00:00`).toLocaleDateString()}</span>}
        {visitor && <span>First visit: {new Date(`${visitor.first_visit_date}T00:00:00`).toLocaleDateString()}</span>}
        {visitor && <span>Contact consent: {visitor.contact_consent ? 'Yes' : 'No'}</span>}
        <span>Workspace: {role}</span>
      </div>

      <section className="care-entry-grid">
        <form className="care-entry" onSubmit={async event => {
          event.preventDefault();
          setBusy(true);
          await onVisit(visitedAt, outcome, visitSummary);
          setVisitSummary('');
          setVisitedAt(localDateTimeValue());
          setBusy(false);
        }}>
          <div className="subheading"><UserRoundCheck size={19} /><div><h3>Record a visit</h3><p>Identify when the person was visited and what happened.</p></div></div>
          <label>Date and time<input type="datetime-local" value={visitedAt} onChange={event => setVisitedAt(event.target.value)} required /></label>
          <label>Outcome<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="completed">Visit completed</option><option value="follow_up_required">Follow-up required</option><option value="no_answer">No answer / unable to meet</option></select></label>
          <label>Visit summary<textarea value={visitSummary} onChange={event => setVisitSummary(event.target.value)} placeholder="What was discussed, observed or agreed?" maxLength={2_000} /></label>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Record visit'}</button>
        </form>

        <form className="care-entry" onSubmit={async event => {
          event.preventDefault();
          if (!noteText.trim()) return;
          setBusy(true);
          await onNote(noteText, noteType);
          setNoteText('');
          setBusy(false);
        }}>
          <div className="subheading"><StickyNote size={19} /><div><h3>Support needed</h3><p>Save a prayer request, practical need or next action.</p></div></div>
          <label>Note category<select value={noteType} onChange={event => setNoteType(event.target.value)}><option value="support">Support need</option><option value="prayer">Prayer request</option><option value="follow_up">Follow-up action</option><option value="practical_need">Practical assistance</option></select></label>
          <label>Care note<textarea value={noteText} onChange={event => setNoteText(event.target.value)} placeholder="Describe the support requested and the next responsible action." maxLength={4_000} required /></label>
          <button className="primary" disabled={busy || !noteText.trim()}>{busy ? 'Saving…' : 'Save support note'}</button>
        </form>
      </section>

      <section className="history-grid">
        <div>
          <div className="history-heading"><h3>Visit history</h3><span>{visits.length}</span></div>
          <div className="timeline-list">
            {visits.map(visit => (
              <article key={visit.id}>
                <div><strong>{visit.outcome.replaceAll('_', ' ')}</strong><small>{new Date(visit.visited_at).toLocaleString()}</small></div>
                {visit.summary && <p>{visit.summary}</p>}
              </article>
            ))}
            {visits.length === 0 && <p className="muted-copy">No visits have been recorded.</p>}
          </div>
        </div>
        <div>
          <div className="history-heading"><h3>Care notes</h3><span>{notes.length}</span></div>
          <div className="timeline-list">
            {notes.map(note => (
              <article key={note.id} className={note.status === 'resolved' ? 'resolved-note' : ''}>
                <div><strong>{note.note_type.replaceAll('_', ' ')}</strong><small>{new Date(note.created_at).toLocaleString()} · {note.status}</small></div>
                <p>{note.note_text}</p>
                <button className="text-btn compact-action" onClick={() => void onResolveNote(note)}>{note.status === 'resolved' ? 'Reopen note' : 'Mark resolved'}</button>
              </article>
            ))}
            {notes.length === 0 && <p className="muted-copy">No support needs have been recorded.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function PersonForm({
  type,
  person,
  userId,
  close,
  done,
}: {
  type: PersonType;
  person: Person | null;
  userId: string;
  close: () => void;
  done: (personId?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visitor = type === 'visitor' ? person as Visitor | null : null;
  const member = type === 'member' ? person as Member | null : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || '').trim() || null;
    const payload = type === 'visitor' ? {
      full_name: text('full_name'),
      preferred_name: text('preferred_name'),
      optional_contact: text('optional_contact'),
      first_visit_date: text('first_visit_date'),
      contact_consent: form.get('contact_consent') === 'on',
      active: true,
    } : {
      first_name: text('first_name'),
      last_name: text('last_name'),
      email: text('email')?.toLowerCase() || null,
      phone: text('phone'),
      address: text('address'),
      ministry: text('ministry'),
      joined_date: text('joined_date'),
      birth_date: text('birth_date'),
      active: true,
    };

    const table = type === 'visitor' ? 'visitors' : 'members';
    const result = person
      ? await supabase.from(table).update(payload).eq('id', person.id).select('id').single()
      : await supabase.from(table).insert({ ...payload, organization_id: organizationId, created_by: userId }).select('id').single();
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await done(result.data?.id);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal person-form-modal" onSubmit={submit}>
        <div><div className="eyebrow">{person ? 'Update record' : 'New record'}</div><h2>{person ? 'Edit' : 'Add'} {type}</h2></div>
        {error && <div className="notice error">{error}</div>}
        {type === 'visitor' ? (
          <>
            <label>Full name<input name="full_name" defaultValue={visitor?.full_name || ''} maxLength={200} required /></label>
            <label>Preferred name<input name="preferred_name" defaultValue={visitor?.preferred_name || ''} maxLength={100} /></label>
            <label>Phone or email<input name="optional_contact" defaultValue={visitor?.optional_contact || ''} maxLength={254} /></label>
            <label>First visit date<input name="first_visit_date" type="date" defaultValue={visitor?.first_visit_date || new Date().toISOString().slice(0, 10)} required /></label>
            <label className="checkbox-label"><input name="contact_consent" type="checkbox" defaultChecked={visitor?.contact_consent || false} /> Person consented to follow-up contact</label>
          </>
        ) : (
          <>
            <div className="form-grid"><label>First name<input name="first_name" defaultValue={member?.first_name || ''} maxLength={100} required /></label><label>Last name<input name="last_name" defaultValue={member?.last_name || ''} maxLength={100} required /></label></div>
            <div className="form-grid"><label>Email<input name="email" type="email" defaultValue={member?.email || ''} maxLength={254} /></label><label>Phone<input name="phone" defaultValue={member?.phone || ''} maxLength={50} /></label></div>
            <label>Address<input name="address" defaultValue={member?.address || ''} maxLength={500} /></label>
            <div className="form-grid"><label>Date of birth<input name="birth_date" type="date" defaultValue={member?.birth_date || ''} /></label><label>Date joined<input name="joined_date" type="date" defaultValue={member?.joined_date || ''} /></label></div>
            <label>Ministry<input name="ministry" defaultValue={member?.ministry || ''} maxLength={100} /></label>
          </>
        )}
        <div className="action-row"><button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button></div>
      </form>
    </div>
  );
}
