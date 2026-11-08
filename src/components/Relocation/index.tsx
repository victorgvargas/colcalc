import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchDatasetCities, fetchDatasetMeta, type DatasetCity, type DatasetMeta } from '../../api/costOfLiving';
import { buildReport, INITIAL_PROFILE, MANUAL_BUDGETS, money, PLANNING_TASKS, summarizeReport, validProfile, type ManualBudgetKey, type Profile } from '../../relocation/model';
import { useWorkspace } from '../../relocation/useWorkspace';
import './relocation.css';

function StorageNotice() {
  const { error } = useWorkspace();
  return <>{error && <p className="notice error" role="alert">{error}</p>}<p className="quiet">Private browser draft · Saved on this device only, independently of your account. Use a personal device. Account sync is not available yet.</p></>;
}

export function RelocationHome() {
  return <div className="relocation">
    <section className="hero"><span className="eyebrow">A new chapter, with a clearer plan</span>
      <h1>Your next home.<br />Your own relocation plan.</h1>
      <p>Bring your household, work and priorities together. Explore a destination, understand the budget, and turn the unknowns into next steps.</p>
      <div className="actions"><Link className="button" to="/onboarding">Build my relocation plan <span aria-hidden="true">&nbsp;↗</span></Link><Link to="/app">Open my workspace</Link></div>
      <p className="quiet">Free planning preview · No account required · Saved on your device</p>
    </section>
    <div className="grid">
      <article className="card"><span className="eyebrow">01 / Your circumstances</span><h2>A plan that starts with you</h2><p>Household size, work, move date and housing preferences shape your destination report.</p></article>
      <article className="card"><span className="eyebrow">02 / Your budget</span><h2>See the assumptions</h2><p>Explore housing, utilities and transport estimates. See exactly which costs still need research.</p></article>
      <article className="card"><span className="eyebrow">03 / Your next steps</span><h2>Keep your move moving</h2><p>Save reports, compare destinations and track the planning questions to resolve before and after your move.</p></article>
    </div>
    <div className="card section"><div className="section-head"><h2>Built for a more informed move</h2><span className="badge pending">Early planning preview</span></div><p>Personalized financial reports are the first step. Reviewed visa pathways, official fee calculations and country-specific arrival instructions are in development. Current reports do not assess immigration eligibility.</p><Link to="/calculator">Looking for a quick calculation? Explore our calculators →</Link></div>
  </div>;
}

export function WorkspaceDashboard() {
  const { workspace, save } = useWorkspace();
  const { reports, profile, completedTasks } = workspace;
  return <div className="relocation"><span className="eyebrow">Your relocation workspace</span><h1>A little clarity.<br />A lot more possibility.</h1><p>Build a picture of your next chapter, one decision at a time.</p>
    <div className="actions"><Link className="button" to="/onboarding">{reports.length ? 'Explore another destination' : 'Create your first plan'}</Link><Link to="/app/profile">Edit household profile</Link></div>
    <StorageNotice />
    <div className="grid"><div className="card"><span className="eyebrow">Your household</span><span className="number">{profile.adults + profile.children} {profile.adults + profile.children === 1 ? 'person' : 'people'}</span><p>{profile.adults} adult(s) · {profile.children} child(ren)</p></div><div className="card"><span className="eyebrow">Destination reports</span><span className="number">{reports.length}</span><p>Saved snapshots of your assumptions</p></div><div className="card"><span className="eyebrow">Planning progress</span><span className="number">{PLANNING_TASKS.filter(t => completedTasks.includes(t.id)).length} / {PLANNING_TASKS.length}</span><p>Research steps completed</p></div></div>
    <section className="section"><div className="section-head"><h2>Your destination reports</h2><span className="quiet">All amounts in USD</span></div>
      {reports.length === 0 ? <div className="empty"><h3>Your next chapter starts here</h3><p>Add your household and choose a city to create your first destination report.</p><Link to="/onboarding">Start planning →</Link></div> : <div className="grid two">{reports.map(report => <article className="card" key={report.id}><span className="badge pending">Preliminary budget</span><h2>{report.city}</h2><p>{report.country} · {new Date(report.createdAt).toLocaleDateString()}</p><span className="number">{money(summarizeReport(report).knownCents)}<small className="quiet"> / month identified</small></span><p>{summarizeReport(report).missing} recurring categories still need research</p><div className="actions"><Link className="button secondary" to={`/app/reports/${report.id}`}>Read report</Link><button className="button secondary" onClick={() => { if (window.confirm(`Delete the saved report for ${report.city}?`)) save({ ...workspace, reports: reports.filter(r => r.id !== report.id) }); }}>Delete<span className="quiet" aria-hidden="true">&nbsp;×</span></button></div></article>)}</div>}
    </section>
    <section className="section card"><h2>Your planning checklist</h2><p>General research prompts. These are not legal requirements or a country-specific arrival checklist.</p>{PLANNING_TASKS.map(task => <label className="task" key={task.id}><input type="checkbox" checked={completedTasks.includes(task.id)} onChange={e => save({ ...workspace, completedTasks: e.target.checked ? [...completedTasks, task.id] : completedTasks.filter(id => id !== task.id) })} /><span><span className="eyebrow">{task.stage}</span><strong>{task.title}</strong><small>{task.detail}</small></span></label>)}</section>
    <p className="quiet"><button className="button secondary" onClick={() => { if (window.confirm('Remove your household profile, all relocation reports and task progress from this browser?')) { save({ version: 1, profile: { ...INITIAL_PROFILE }, reports: [], completedTasks: [] }); } }}>Clear relocation data on this device</button></p>
  </div>;
}

export function ProfileEditor() {
  const { workspace, save } = useWorkspace();
  const [profile, setProfile] = useState<Profile>({ ...workspace.profile });
  const [cities, setCities] = useState<DatasetCity[]>([]);
  const [source, setSource] = useState<DatasetMeta>({});
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDatasetCities(), fetchDatasetMeta()]).then(([data, meta]) => {
      if (!cancelled) { setCities([...data].sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city))); setSource(meta); setStatus('ready'); }
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [attempt]);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile(current => ({ ...current, [key]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validProfile(profile)) { setError('Please check your household details.'); return; }
    const city = cities.find(c => JSON.stringify([c.city, c.country]) === selected);
    if (!city) { setError('Choose a destination from the list.'); return; }
    if (workspace.reports.length >= 50) { setError('Your browser has 50 reports. Delete an older report before adding another.'); return; }
    const report = buildReport(city, profile, source);
    if (save({ ...workspace, profile: { ...profile }, reports: [report, ...workspace.reports] })) navigate(`/app/reports/${report.id}`);
  }
  return <div className="relocation"><span className="eyebrow">Make room for your next chapter</span><h1>First, a little about your move.</h1><p>Start with what you know. Your report will make the remaining questions visible.</p><StorageNotice />
    <form className="card" onSubmit={submit}>
      <fieldset><legend>01 · Your household</legend><div className="fields">
        <label>Citizenship(s)<input maxLength={300} value={profile.citizenships} onChange={e => update('citizenships', e.target.value)} placeholder="e.g. Brazil, Italy" /><small>Optional. Stored for planning; not used to infer visa eligibility.</small></label>
        <label>Current country of residence<input maxLength={150} value={profile.residence} onChange={e => update('residence', e.target.value)} placeholder="Where you live now" /></label>
        <label>Adults<input type="number" min="1" max="10" required value={profile.adults} onChange={e => update('adults', Number(e.target.value))} /></label>
        <label>Children<input type="number" min="0" max="10" required value={profile.children} onChange={e => update('children', Number(e.target.value))} /></label>
      </div></fieldset>
      <fieldset><legend>02 · Work and timing</legend><div className="fields">
        <label>Work situation<select value={profile.employment} onChange={e => update('employment', e.target.value as Profile['employment'])}><option value="employed">Employed</option><option value="self-employed">Self-employed / remote business</option><option value="retired">Retired</option><option value="studying">Studying</option><option value="other">Other / still deciding</option></select></label>
        <label>Target move month<input type="month" value={profile.moveMonth} onChange={e => update('moveMonth', e.target.value)} /></label>
        <label>Expected household monthly net income (USD)<input type="number" min="0" max="1000000000" step="0.01" value={profile.netIncomeUsd ?? ''} onChange={e => update('netIncomeUsd', e.target.value === '' ? null : Number(e.target.value))} placeholder="Leave blank if unknown" /><small>Your own after-tax estimate for the destination. No tax calculation is applied.</small></label>
      </div></fieldset>
      <fieldset><legend>03 · Your destination and home</legend><div className="fields">
        <label>Destination city<select required value={selected} disabled={status !== 'ready'} onChange={e => setSelected(e.target.value)}><option value="">{status === 'loading' ? 'Loading destinations…' : 'Choose a city'}</option>{cities.map(c => <option key={JSON.stringify([c.city, c.country])} value={JSON.stringify([c.city, c.country])}>{c.country} · {c.city}</option>)}</select></label>
        <label>Home size<select value={profile.bedrooms} onChange={e => update('bedrooms', e.target.value as Profile['bedrooms'])}><option value="1">1 bedroom</option><option value="3">3 bedrooms</option></select><small>Only sizes represented in the current dataset are offered.</small></label>
        <label>Location preference<select value={profile.location} onChange={e => update('location', e.target.value as Profile['location'])}><option value="outskirts">Outside the city center</option><option value="center">City center</option></select></label>
      </div></fieldset>
      <fieldset><legend>04 · Fill in your own monthly budgets</legend><p>Optional household amounts in USD. Leave unknown costs blank; enter zero only if a category genuinely does not apply. Include child travel and other recurring obligations under other spending.</p><div className="fields">{(Object.entries(MANUAL_BUDGETS) as [ManualBudgetKey, string][]).filter(([key]) => key !== 'childcare' || profile.children > 0).map(([key, label]) => <label key={key}>{label} (monthly USD)<input type="number" min="0" max="1000000000" step="0.01" value={profile.monthlyBudgets?.[key] ?? ''} onChange={e => update('monthlyBudgets', { ...profile.monthlyBudgets, [key]: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Unknown" /></label>)}</div></fieldset>
      {status === 'error' && <div className="notice error" role="alert">We could not load destination prices. <button type="button" onClick={() => { setStatus('loading'); setAttempt(a => a + 1); }}>Try again</button></div>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <p className="notice">This preview uses the existing city price dataset. Observation dates are unavailable. Missing spending categories remain unknown, and immigration pathways and fees are not assessed.</p>
      <div className="actions"><button className="button" type="submit" disabled={status !== 'ready'}>Create my destination report →</button><button className="button secondary" type="button" onClick={() => { if (!validProfile(profile)) setError('Please check your household details.'); else if (save({ ...workspace, profile: { ...profile } })) navigate('/app'); }}>Save profile only</button><Link to="/app">Back to workspace</Link></div>
    </form>
  </div>;
}

export function DestinationReport() {
  const { workspace } = useWorkspace();
  const { id } = useParams();
  const report = workspace.reports.find(r => r.id === id);
  if (!report) return <div className="relocation"><h1>Report not found on this device.</h1><p>Reports are saved in the browser where you created them. This link does not share a report.</p><Link className="button" to="/app">Return to workspace</Link></div>;
  const summary = summarizeReport(report);
  const profile = report.profile;
  const changed = JSON.stringify(profile) !== JSON.stringify(workspace.profile);
  return <div className="relocation report"><div className="no-print"><Link to="/app">← Your workspace</Link></div><div className="section-head section"><span className="eyebrow">Your destination report · Version 1</span><span className="badge pending">Partial planning estimate</span></div><h1>Your next chapter in {report.city}.</h1><p>{report.country} · Created {new Date(report.createdAt).toLocaleString()} · All amounts in USD</p>
    <div className="actions no-print"><button className="button" onClick={() => window.print()}>Print / save as PDF</button><Link to="/onboarding">Create another scenario →</Link></div>
    {changed && <p className="notice">Your household profile has changed. This report retains its original assumptions. Create another scenario to use your latest profile.</p>}
    <div className="grid"><div className="card"><span className="eyebrow">Identified monthly costs</span><span className="number">{money(summary.knownCents)}</span><p>{summary.missing ? 'Partial subtotal' : 'Budget estimate'} · {summary.missing} categories unknown</p></div><div className="card"><span className="eyebrow">Your stated net income</span><span className="number">{profile.netIncomeUsd === null ? 'Not provided' : money(Math.round(profile.netIncomeUsd * 100))}</span><p>Monthly household income · User estimate</p></div><div className="card"><span className="eyebrow">Monthly surplus</span><span className="number">{summary.totalCents !== null && profile.netIncomeUsd !== null ? money(Math.round(profile.netIncomeUsd * 100) - summary.totalCents) : 'Not yet known'}</span><p>{summary.totalCents === null ? 'Complete spending and confirm destination net income first' : 'Based on your stated income and budget assumptions'}</p></div></div>
    <section className="card section"><h2>The household behind this report</h2><p>{profile.adults} adult(s) · {profile.children} child(ren) · {profile.employment} · Move: {profile.moveMonth || 'Not decided'}</p><p>Citizenship(s): {profile.citizenships || 'Not provided'} · Current residence: {profile.residence || 'Not provided'}</p><p>{profile.bedrooms} bedroom(s) · {profile.location === 'center' ? 'City center' : 'Outside the city center'}</p></section>
    <section className="card section"><h2>Your monthly living budget</h2><p>{summary.missing ? 'Missing categories are unknown, not zero. This is not a complete cost-of-living estimate.' : 'All listed categories are covered by dataset estimates or your own budgets. Review these assumptions against current quotes.'}</p><div className="table-wrap"><table><thead><tr><th scope="col">Category</th><th scope="col">Assumption</th><th scope="col">Monthly USD</th></tr></thead><tbody>{report.lines.map(line => <tr key={line.label}><th scope="row">{line.label}</th><td>{line.basis}</td><td>{line.monthlyCents === null ? <span className="badge pending">Needs research</span> : money(line.monthlyCents)}</td></tr>)}</tbody><tfoot><tr><th scope="row" colSpan={2}>{summary.missing ? 'Identified subtotal · incomplete' : 'Estimated monthly budget'}</th><td><strong>{money(summary.knownCents)}</strong></td></tr></tfoot></table></div></section>
    <div className="grid two"><section className="card"><span className="badge pending">Reviewed coverage unavailable</span><h2>Visa pathways & official fees</h2><p>This report does not determine whether you need a visa or qualify for a route. Citizenship, residence status, work arrangements and application location require verified country rules.</p><p>Check with the destination’s responsible immigration or consular authority before making commitments.</p></section><section className="card"><span className="badge pending">Not calculated</span><h2>Cash needed to relocate</h2><p>Official charges, deposits, travel, temporary housing and proof-of-funds are not included. A first-year total or cash requirement would be incomplete.</p><p>Refundable deposits and funds held as evidence should be tracked separately from spending.</p></section></div>
    <section className="card section"><h2>Research before and after your move</h2><p>General prompts, not verified local procedures or deadlines. Track progress in your workspace.</p>{PLANNING_TASKS.map(task => <div key={task.id}><span className="eyebrow">{task.stage}</span><h3>{task.title}</h3><p>{task.detail}</p></div>)}<Link className="no-print" to="/app">Open your checklist →</Link></section>
    <section className="card section"><h2>Sources & limitations</h2><p>Source: {report.source.source || 'Bundled city price dataset'}. <a href="/cost-of-living.json">View the current dataset</a>.</p><p>Dataset generated: {report.source.generatedAt ? new Date(report.source.generatedAt).toLocaleDateString() : 'Unavailable'}. Price observation dates: unavailable. Generation date is not the price observation date.</p><p>Source prices are dataset USD values. No live exchange rate, tax calculation, immigration assessment or AI-generated legal claim was used. Budget engine: preliminary basket v{report.engineVersion}. This report preserves the values used at creation; the current dataset may change.</p><p className="quiet">Report ID: {report.id}. Saved only in this browser. Printed copies include personal profile information.</p></section>
  </div>;
}
