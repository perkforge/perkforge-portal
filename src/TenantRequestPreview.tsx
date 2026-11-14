import { useEffect, useRef, useState } from 'react';
type Capability = { configured: boolean; authorized: boolean; mode: string };
const reasons: Record<string, string> = {
  'reviewed-context-unavailable': 'Reviewed context is missing, stale or belongs to another environment. Nothing was saved.',
  'subject-not-approved-for-context': 'This subject is not approved for the selected context. Nothing was saved.',
  'admin-membership-policy-unconfigured': 'Administrator membership changes are not configured.',
  'access-denied': 'You are not authorized to preview this context.',
  'invalid-membership-request': 'Check the context, reviewed subject ID and selected role.',
};
export default function TenantRequestPreview({ csrf }: { csrf: string }) {
  const [capability, setCapability] = useState<Capability>(); const [availability, setAvailability] = useState('Checking preview availability…');
  const [tenant, setTenant] = useState(''); const [subject, setSubject] = useState('');
  const [operation, setOperation] = useState('add-membership'); const [role, setRole] = useState('tenant-viewer');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const sequence = useRef(0); const flight = useRef<AbortController | null>(null);
  function clear() { sequence.current++; flight.current?.abort(); flight.current = null; setBusy(false); setMessage(''); setTenant(''); setSubject(''); setOperation('add-membership'); setRole('tenant-viewer'); }
  function close() { dialog.current?.close(); clear(); }
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    dialog.current?.close(); clear(); setCapability(undefined);
    fetch('/bff/tenant-requests/capability', { credentials: 'same-origin', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Preview availability could not be verified.');
      const value = await response.json();
      if (value.mode !== 'preview-only' || typeof value.configured !== 'boolean' || typeof value.authorized !== 'boolean') throw new Error('Preview availability could not be verified.');
      if (active) { setCapability(value); setAvailability(!value.configured ? 'Request previews are not configured. Tenant creation and user changes remain unavailable.' : !value.authorized ? 'Request previews require platform administration or tenant-admin authority for the exact context.' : 'Preview only. A fresh reviewed context is still required. Nothing is saved or submitted.'); }
    }).catch(() => { if (active) setAvailability('Request previews are unavailable. No changes can be submitted.'); });
    return () => { active = false; controller.abort(); sequence.current++; flight.current?.abort(); flight.current = null; };
  }, [csrf]);
  useEffect(() => {
    const dismiss = () => { dialog.current?.close(); sequence.current++; flight.current?.abort(); flight.current = null; setBusy(false); setMessage(''); setTenant(''); setSubject(''); };
    window.addEventListener('hashchange', dismiss);
    return () => window.removeEventListener('hashchange', dismiss);
  }, []);
  async function preview(event: React.FormEvent) {
    event.preventDefault(); if (flight.current || !capability?.configured || !capability.authorized) return;
    const requestSequence = ++sequence.current; const controller = new AbortController(); flight.current = controller; setBusy(true); setMessage('');
    try {
      const response = await fetch('/bff/tenant-requests/preview', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ operation, tenant, subject, role }) });
      if (requestSequence !== sequence.current) return;
      if (response.status === 401) throw new Error('Your session has ended. Sign in again; nothing was saved.');
      if (response.status === 503) throw new Error('Request previews are unavailable. Nothing was saved or submitted.');
      const result = await response.json();
      if (requestSequence !== sequence.current) return;
      if (result.persisted !== false || result.submitted !== false || result.writable !== false || result.readyToSubmit !== false) throw new Error('The preview could not be verified. Nothing was submitted by this form.');
      if (response.ok && result.status === 'proposal') setMessage('Draft preview only: this membership change needs review. Nothing was saved, submitted or changed.');
      else if (response.ok && result.status === 'no-change') setMessage('No change in the reviewed snapshot. This is not a live membership check; nothing was saved.');
      else setMessage(reasons[result.reason] || 'This request cannot be previewed. Nothing was saved or submitted.');
    } catch (error) { if (requestSequence === sequence.current && !controller.signal.aborted) setMessage((error as Error).message); }
    finally { if (requestSequence === sequence.current) { flight.current = null; setBusy(false); } }
  }
  return <section className="panel request-preview" aria-label="Membership request preview"><h2>Membership request preview</h2><p role="status">{availability}</p><p>Review a developer or viewer membership change for an existing approved identity. No account creation, administrator grants or tenant provisioning.</p><button disabled={!capability?.configured || !capability.authorized} onClick={() => { clear(); dialog.current?.showModal(); }}>Review membership change</button>
    <dialog ref={dialog} onCancel={clear} aria-labelledby="request-preview-title"><h2 id="request-preview-title">Preview, not submit</h2><p>No request is saved. Use only a context and immutable subject ID already reviewed by the platform.</p>
      <form onSubmit={event => void preview(event)}>
        <label>Tenant context<input required maxLength={31} pattern="[a-z][a-z0-9-]*" value={tenant} disabled={busy} onChange={e => { setTenant(e.target.value); setMessage(''); }} autoComplete="off" /></label>
        <label>Reviewed subject ID<input required maxLength={36} pattern="[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}" value={subject} disabled={busy} onChange={e => { setSubject(e.target.value); setMessage(''); }} autoComplete="off" spellCheck={false} /></label>
        <label>Action<select value={operation} disabled={busy} onChange={e => { setOperation(e.target.value); setMessage(''); }}><option value="add-membership">Add membership</option><option value="remove-membership">Remove membership</option></select></label>
        <label>Tenant role<select value={role} disabled={busy} onChange={e => { setRole(e.target.value); setMessage(''); }}><option value="tenant-viewer">Viewer</option><option value="tenant-developer">Developer</option></select></label>
        <div className="actions"><button type="submit" disabled={busy}>{busy ? 'Checking preview…' : 'Preview change'}</button><button type="button" className="secondary" onClick={close}>Cancel</button></div>
      </form>{message && <p className="notice" role="status">{message}</p>}<p className="fine">Before an actual change: recheck identity and authorization, obtain a scoped writer, persist an auditable request and verify downstream access. This form does none of those operations.</p>
    </dialog></section>;
}
