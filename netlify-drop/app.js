(function () {
  const M = window.MOT, A = window.Assistant;
  const $ = s => document.querySelector(s);
  const view = $('#view'), tabs = $('#tabs'), askBtn = $('#askBtn');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- storage (can throw in private mode) ----------
  // Several people can use one device: state.people[id] = { profile, checkins, prescriptions, arranged, records, events }.
  // profile is the latest check-in; checkins keeps every dated check-in, newest first.
  const KEY = 'eyeMot.v3';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  let state = { people: {}, current: null, draft: {}, editing: false, ...load() };
  // Display and voice settings belong to the device, not a person.
  const DEFAULTS = { chosen: false, voice: false, autoRead: false, voiceName: '', rate: 0.9, text: 'standard', contrast: false, motion: false };
  state.settings = { ...DEFAULTS, ...(state.voiceAuto ? { voice: true, autoRead: true } : {}), ...state.settings };
  delete state.voiceAuto;
  const SET = state.settings;
  const cur = () => state.people[state.current] || null;
  const person = profile => ({ profile, checkins: [{ date: profile.completedAt, profile }], prescriptions: [], arranged: {}, records: [], events: [{ date: profile.completedAt, text: 'First check-in' }] });
  for (const x of Object.values(state.people)) { x.checkins ||= [{ date: x.profile.completedAt, profile: x.profile }]; x.prescriptions ||= []; }
  // What the rules see: the latest answers plus the latest prescription.
  const viewP = () => { const c = cur(); return c && { ...c.profile, rx: c.prescriptions[0] || null }; };
  const log = text => cur().events.unshift({ date: today(), text });
  const initial = p => (p.name || '?').trim().charAt(0).toUpperCase() || '?';

  // Small stroke icons (inline SVG, inherit text colour).
  const svg = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    speaker: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  };

  // ---------- prescriptions ----------
  const num = v => v === '' || v == null ? '' : String(v);
  const rxFields = (rx = {}) => { const re = rx.re || {}, le = rx.le || {};
    const cell = (n, v, lab, min, max, step) => `<input type="number" name="${n}" value="${esc(num(v))}" min="${min}" max="${max}" step="${step}" aria-label="${lab}">`;
    return `<div class="scanbox"><label class="filepick"><input type="file" accept="image/*" capture="environment" data-scan>
        <span class="btn sm">${ICON.camera} Scan your prescription</span></label>
        <p class="small scanstatus" aria-live="polite">Take a photo of your slip and we’ll fill in the numbers. You check them before saving.</p></div>
      <label class="field"><span>Date of prescription</span><input type="date" name="rx_date" value="${esc(rx.date || '')}" max="${today()}"></label>
      <div class="rxgrid"><span></span><b>Sphere</b><b>Cylinder</b><b>Axis</b>
        <b>Right</b>${cell('re_sph', re.sph, 'Right sphere', -30, 30, .25)}${cell('re_cyl', re.cyl, 'Right cylinder', -10, 10, .25)}${cell('re_axis', re.axis, 'Right axis', 0, 180, 1)}
        <b>Left</b>${cell('le_sph', le.sph, 'Left sphere', -30, 30, .25)}${cell('le_cyl', le.cyl, 'Left cylinder', -10, 10, .25)}${cell('le_axis', le.axis, 'Left axis', 0, 180, 1)}</div>
      <label class="field" style="margin-top:8px"><span>Reading addition (“Add”, if shown)</span>${cell('rx_add', rx.add, 'Reading addition', 0, 4, .25)}</label>
      <p class="hint">Copy the numbers from your prescription slip. Leave boxes blank if they’re empty on the slip.</p>`; };
  function readRx(f) {
    const v = n => (f[n] ? String(f[n]).trim() : '');
    const eye = k => ({ sph: v(k + '_sph'), cyl: v(k + '_cyl'), axis: v(k + '_axis') });
    const rx = { date: v('rx_date'), re: eye('re'), le: eye('le'), add: v('rx_add') };
    if (!rx.re.sph && !rx.le.sph) return null;
    for (const [k, lo, hi] of [['sph', -30, 30], ['cyl', -10, 10], ['axis', 0, 180]])
      for (const e of [rx.re, rx.le]) if (e[k] !== '' && !(+e[k] >= lo && +e[k] <= hi)) return { error: `Check the ${k === 'sph' ? 'sphere' : k === 'cyl' ? 'cylinder' : 'axis'} numbers.` };
    return rx;
  }
  let lastScan = null;
  async function onScan(input) {
    const file = input.files[0]; if (!file) return;
    const form = input.form, status = input.closest('.scanbox').querySelector('.scanstatus');
    status.textContent = 'Reading your prescription… (the first scan downloads the reader)';
    try {
      const { rx } = await window.RxScan.scan(file, p => { status.textContent = `Reading your prescription… ${Math.round(p * 100)}%`; });
      if (!rx) { status.textContent = 'We couldn’t read the numbers. Try a closer, well-lit photo, or type them in.'; return; }
      form.querySelectorAll('.checkme').forEach(el => el.classList.remove('checkme'));
      const set = (n, v) => { if (v !== '' && form.elements[n]) form.elements[n].value = parseFloat(v); };
      set('re_sph', rx.re.sph); set('re_cyl', rx.re.cyl); set('re_axis', rx.re.axis);
      set('le_sph', rx.le.sph); set('le_cyl', rx.le.cyl); set('le_axis', rx.le.axis); set('rx_add', rx.add);
      if (form.elements.rx_date) form.elements.rx_date.value = rx.date || '';
      if (!rx.date) rx.check.push('rx_date');
      lastScan = { form, file };
      rx.check.forEach(n => { const el = form.elements[n]; if (el) { el.classList.add('checkme'); el.addEventListener('input', () => el.classList.remove('checkme'), { once: true }); } });
      const nSign = rx.check.filter(n => n !== 'rx_date').length;
      const signs = (nSign ? ` We couldn’t read the + or − on ${nSign === 1 ? 'one highlighted box' : nSign + ' highlighted boxes'}: please add it.` : '') + (rx.date ? '' : ' We couldn’t read the date: please enter it.');
      status.innerHTML = `<strong>Filled in from your photo.</strong> Check every number against your slip before saving.${signs}`;
      window.Voice && window.Voice.say('Filled in from your photo. Please check every number against your slip.' + signs);
    } catch { status.textContent = 'The scanner couldn’t load. Check your connection, or type the numbers in.'; }
  }
  const RX_KEYS = ['rx_date', 're_sph', 're_cyl', 're_axis', 'le_sph', 'le_cyl', 'le_axis', 'rx_add'];
  const sign = n => n === '' ? '—' : (+n > 0 ? '+' : '') + (+n).toFixed(2);
  const rxEye = e => e && e.sph !== '' ? `${sign(e.sph)}${e.cyl ? ' / ' + sign(e.cyl) : ''}${e.axis ? ' × ' + e.axis + '°' : ''}` : '—';
  const rxDesc = rx => { const s = [rx.re, rx.le].map(e => parseFloat(e && e.sph)).filter(Number.isFinite);
    return s.some(n => n < 0) && s.some(n => n > 0) ? 'Short-sighted in one eye, long-sighted in the other' : s.some(n => n < 0) ? 'Short-sighted' : s.some(n => n > 0) ? 'Long-sighted' : 'No sphere correction'; };
  const rxTable = rx => `<table class="kv rx"><tr><th></th><th>Sphere / cyl × axis</th></tr><tr><th>Right</th><td>${rxEye(rx.re)}</td></tr><tr><th>Left</th><td>${rxEye(rx.le)}</td></tr>${rx.add ? `<tr><th>Add</th><td>${sign(rx.add)}</td></tr>` : ''}</table>`;

  // Map the family-history answers onto what the rules use.
  function derive(p) {
    const rel = p.fhGlaucomaRel || [];
    const close = rel.some(r => r !== 'other');
    return { ...p,
      fhGlaucoma: p.fhGlaucomaAny === 'yes' ? (close ? 'close' : 'other') : p.fhGlaucomaAny === 'unsure' ? 'unsure' : 'none',
      fhGlaucomaWho: rel.map(r => L.rel[r]).join(', ').toLowerCase() };
  }

  // ---------- labels ----------
  const L = {
    nation: { england: 'England', scotland: 'Scotland', wales: 'Wales', ni: 'Northern Ireland' },
    // Top-level ethnic groups used by the ONS census for England and Wales.
    ethnicity: { asian: 'Asian or Asian British', blackAfricanCaribbean: 'Black, Black British, Caribbean or African', mixed: 'Mixed or multiple ethnic groups', white: 'White', other: 'Other ethnic group (for example Arab)', undisclosed: 'Prefer not to say' },
    diabetes: { none: 'No', type1: 'Type 1', type2: 'Type 2', unsure: 'Not sure' },
    conditions: { glaucoma: 'Glaucoma', amd: 'AMD (macular degeneration)', cataract: 'Cataracts', retinopathy: 'Diabetic retinopathy', other: 'Other eye condition' },
    yesNo: { no: 'No', yes: 'Yes', unsure: 'Not sure' },
    rel: { parent: 'Parent', sibling: 'Brother or sister', child: 'Child', other: 'Grandparent or other relative' },
    smoking: { never: 'Never', ex: 'Used to', current: 'Yes, currently' },
    lastTest: { lt1: 'Within the last year', '1to2': '1 to 2 years ago', gt2: 'More than 2 years ago', never: 'Never, or can’t remember' },
    record: { glasses: 'Glasses prescription', contacts: 'Contact lens prescription', sightTest: 'Sight test result', screening: 'Screening letter', clinic: 'Eye clinic letter', other: 'Other' },
  };

  // Demo: Amara (fictional) has used the app for three years. Every item is sample data.
  const LEEDS = { postcode: 'LS1 4AP', lat: 53.795472, lon: -1.555729, area: 'Leeds', nation: 'england' };
  function demoAmara() {
    const base = { name: 'Amara', nation: 'england', ethnicity: 'blackAfricanCaribbean', bp: false, myopia: true, conditions: [], sightImpaired: false, benefits: false,
      fhGlaucomaAny: 'yes', fhGlaucomaRel: ['parent'], fhAMD: false, fhDiabetes: true, smoking: 'never', drives: true, contacts: false, screens: true, symptoms: [],
      postcode: 'LS1 4AP', geo: LEEDS };
    const at = (date, o) => derive({ ...base, ...o, completedAt: date });
    const checkins = [
      { date: '2026-09-26', profile: at('2026-09-26', { age: 47, diabetes: 'type2', bp: true, lastTest: '1to2', notes: 'Dad was diagnosed with glaucoma at 55. Tired eyes after long days at work.' }) },
      { date: '2025-09-20', profile: at('2025-09-20', { age: 46, diabetes: 'type2', bp: true, lastTest: 'lt1', notes: 'New glasses this month.' }) },
      { date: '2024-04-02', profile: at('2024-04-02', { age: 45, diabetes: 'type2', lastTest: 'lt1', notes: 'Diagnosed with type 2 diabetes in March.' }) },
      { date: '2023-10-02', profile: at('2023-10-02', { age: 44, diabetes: 'none', lastTest: 'gt2', notes: 'Dad was diagnosed with glaucoma at 55.' }) },
    ];
    return { profile: checkins[0].profile, checkins,
      prescriptions: [
        { date: '2025-09-12', re: { sph: '-2.75', cyl: '-0.50', axis: '180' }, le: { sph: '-2.50', cyl: '-0.25', axis: '175' }, add: '' },
        { date: '2023-11-04', re: { sph: '-2.25', cyl: '-0.50', axis: '180' }, le: { sph: '-2.00', cyl: '-0.25', axis: '175' }, add: '' }],
      arranged: { des: '2026-06-30' },
      records: [
        { type: 'screening', date: '2026-07-15', note: 'Diabetic eye screening result letter (sample)' },
        { type: 'sightTest', date: '2025-09-12', note: 'Sight test at local optician, glaucoma checks done (sample)' },
        { type: 'glasses', date: '2025-09-12', note: 'New distance glasses (sample)' },
        { type: 'screening', date: '2024-07-08', note: 'First diabetic eye screening letter (sample)' },
        { type: 'other', date: '2024-03-14', note: 'GP letter: type 2 diabetes diagnosis (sample)' },
        { type: 'sightTest', date: '2023-11-04', note: 'First sight test in 5 years, free because of family history (sample)' }],
      events: [
        { date: '2026-09-26', text: 'New check-in: last sight test now 1 to 2 years ago' },
        { date: '2026-07-15', text: 'Added screening letter' },
        { date: '2026-06-30', text: 'Marked "Diabetic eye screening" as arranged' },
        { date: '2025-09-20', text: 'New check-in' },
        { date: '2025-09-12', text: 'Added a prescription from 12 Sept 2025' },
        { date: '2024-07-08', text: 'Added screening letter' },
        { date: '2024-04-02', text: 'New check-in: diabetes type 2 added, diabetic eye screening joined the plan' },
        { date: '2024-03-14', text: 'Added GP letter' },
        { date: '2023-11-04', text: 'Added a prescription from 4 Nov 2023' },
        { date: '2023-10-20', text: 'Marked "Sight test with an optician" as arranged' },
        { date: '2023-10-02', text: 'First check-in' }] };
  }
  const NOSETUP = new URLSearchParams(location.search).has('nosetup');   // read before the demo link rewrites the address
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo === 'amara') {
    state.people['demo-amara'] = demoAmara(); state.current = 'demo-amara';
    save(); history.replaceState(null, '', location.pathname + '#home');
  }

  // ---------- questionnaire ----------
  const radio = (name, opts, val) => Object.entries(opts).map(([v, t]) =>
    `<label class="opt"><input type="radio" name="${name}" value="${v}" ${val === v ? 'checked' : ''}> ${esc(t)}</label>`).join('');
  const check = (name, label, val) => `<label class="opt"><input type="checkbox" name="${name}" ${val ? 'checked' : ''}> ${esc(label)}</label>`;
  const multi = (name, opts, vals = []) => Object.entries(opts).map(([v, t]) =>
    `<label class="opt"><input type="checkbox" name="${name}" value="${v}" ${vals.includes(v) ? 'checked' : ''}> ${esc(t)}</label>`).join('');

  const STEPS = [
    { title: 'About you', sub: 'So we can match NHS guidance for your age and where you live.', html: d => `
      <label class="field"><span>First name (optional)</span><input type="text" name="name" value="${esc(d.name)}" autocomplete="given-name"></label>
      <label class="field"><span>Postcode (optional)</span><input type="text" name="postcode" value="${esc(d.postcode)}" autocomplete="postal-code" autocapitalize="characters" maxlength="8" placeholder="e.g. LS1 4AP">
        <p class="hint" id="pcHint">Used to find opticians and eye services near you. Only your postcode is sent, to postcodes.io and OpenStreetMap.</p></label>
      <label class="field"><span>Which UK country do you live in?</span><select name="nation" required>
        <option value="">Choose</option>${Object.entries(L.nation).map(([v, t]) => `<option value="${v}" ${d.nation === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <p class="hint">NHS eye care rules and services differ across the UK.</p></label>
      <label class="field"><span>Age</span><input type="number" name="age" inputmode="numeric" min="0" max="120" value="${esc(d.age)}" required></label>
      <div id="edu">${check('fullTimeEducation', 'I am in full-time education', d.fullTimeEducation)}</div>
      <fieldset><legend>Ethnic background (optional)</legend><p class="hint">The NHS lists a Black African, Caribbean or Asian background as a glaucoma risk factor.</p>${radio('ethnicity', L.ethnicity, d.ethnicity)}</fieldset>`,
      check: d => !d.nation ? 'Choose where you live.' : !(Number.isInteger(d.age) && d.age >= 0 && d.age <= 120) ? 'Enter your age as a whole number.' : null },
    { title: 'Your health', sub: 'Only conditions that NHS pages link to eye health.', html: d => `
      <fieldset><legend>Have you been diagnosed with diabetes?</legend>${radio('diabetes', L.diabetes, d.diabetes)}</fieldset>
      <fieldset><legend>Eye conditions you have been diagnosed with</legend>${multi('conditions', L.conditions, d.conditions)}</fieldset>
      <fieldset><legend>Also true for me</legend>
        ${check('myopia', 'I am short-sighted', d.myopia)}${check('bp', 'I have high blood pressure', d.bp)}
        ${check('sightImpaired', 'I am registered as partially sighted or blind', d.sightImpaired)}
        ${check('benefits', 'I get income-related benefits or hold an HC2/HC3 certificate', d.benefits)}</fieldset>`,
      check: d => !d.diabetes ? 'Answer the diabetes question.' : null },
    { title: 'Family history', sub: 'Only conditions that NHS pages link to eye health.', html: d => `
      <fieldset><legend>Glaucoma in your family?</legend>${radio('fhGlaucomaAny', L.yesNo, d.fhGlaucomaAny)}
        <div id="who"><p class="hint" style="margin-top:8px">Which relatives? Choose all that apply.</p>${multi('fhGlaucomaRel', L.rel, d.fhGlaucomaRel)}</div></fieldset>
      <fieldset><legend>Also in your family</legend>
        ${check('fhAMD', 'AMD (age-related macular degeneration)', d.fhAMD)}${check('fhDiabetes', 'Diabetes', d.fhDiabetes)}</fieldset>`,
      check: d => !d.fhGlaucomaAny ? 'Answer the glaucoma question.' : d.fhGlaucomaAny === 'yes' && !(d.fhGlaucomaRel || []).length ? 'Choose which relatives.' : null },
    { title: 'Lifestyle', sub: 'Habits the NHS links to eye health or eye tests.', html: d => `
      <fieldset><legend>Do you smoke?</legend>${radio('smoking', L.smoking, d.smoking)}</fieldset>
      <fieldset><legend>Also true for me</legend>
        ${check('drives', 'I drive', d.drives)}${check('contacts', 'I wear contact lenses', d.contacts)}${check('screens', 'I use a screen for most of my working day', d.screens)}</fieldset>`,
      check: d => !d.smoking ? 'Answer the smoking question.' : null },
    { title: 'Eye tests and anything else', sub: 'Last few questions.', html: d => `
      <fieldset><legend>When was your last sight test?</legend>${radio('lastTest', L.lastTest, d.lastTest)}</fieldset>
      <fieldset><legend>Do you have any of these right now?</legend><p class="hint">This is not a diagnosis. It checks whether NHS guidance says to get help today.</p>
        ${multi('symptoms', Object.fromEntries(M.SYMPTOMS.map(s => [s.id, s.label])), d.symptoms)}</fieldset>
      <details class="card" ${d.re_sph || d.le_sph ? 'open' : ''}><summary><strong>Add your glasses or contact lens prescription (optional)</strong><span class="small" style="display:block">It makes your suggestions more personal: for example, being short-sighted is an NHS-listed risk factor for glaucoma.</span></summary>
        <div style="margin-top:12px">${rxFields(d.re_sph || d.le_sph ? { date: d.rx_date, re: { sph: d.re_sph, cyl: d.re_cyl, axis: d.re_axis }, le: { sph: d.le_sph, cyl: d.le_cyl, axis: d.le_axis }, add: d.rx_add } : {})}</div></details>
      <label class="field"><span>Anything else? (optional)</span><textarea name="notes" rows="3" maxlength="400">${esc(d.notes)}</textarea>
        <p class="hint">We don't interpret this. It's saved as a note for you to mention to your optician.</p></label>`,
      check: d => !d.lastTest ? 'Tell us when your last sight test was.' : (readRx(d) || {}).error || null },
  ];

  function readForm(form, d) {
    const out = { ...d };
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox' && el.value !== 'on') out[el.name] = [...form.querySelectorAll(`[name="${el.name}"]:checked`)].map(x => x.value);
      else if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'number') out[el.name] = el.value === '' ? undefined : Number(el.value);
      else out[el.name] = el.value;
    }
    if (out.fhGlaucomaAny !== 'yes') out.fhGlaucomaRel = [];
    return out;
  }

  // ---------- voice ----------
  const V = window.Voice || { canSpeak: false, canListen: false, say() {}, stop() {} };
  const clean = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  // Each question: a fieldset (radios / checkboxes) or a labelled field (text, number, select, textarea).
  function questions(form) {
    const qs = [];
    form.querySelectorAll('fieldset').forEach(fs => {
      const inputs = [...fs.querySelectorAll('input[type=radio], input[type=checkbox]')];
      if (!inputs.length) return;
      qs.push({ el: fs, head: fs.querySelector('legend'), text: clean(fs.querySelector('legend')), hint: clean(fs.querySelector('.hint')), inputs,
        options: inputs.map(i => ({ value: i.value === 'on' ? i.name : i.value, label: clean(i.parentElement), input: i })), multiple: inputs[0].type === 'checkbox' });
    });
    form.querySelectorAll('label.field').forEach(lab => {
      const c = lab.querySelector('input:not([type=date]):not([type=file]), select, textarea'); if (!c || lab.closest('.rxgrid, details')) return;
      qs.push({ el: lab, head: lab.querySelector('span'), text: clean(lab.querySelector('span')), hint: clean(lab.querySelector('.hint')), control: c,
        options: c.tagName === 'SELECT' ? [...c.options].filter(o => o.value).map(o => ({ value: o.value, label: o.text })) : null });
    });
    return qs.sort((a, b) => a.el.compareDocumentPosition(b.el) & 2 ? 1 : -1);
  }
  function current(q) {
    if (q.inputs) { const on = q.options.filter(o => o.input.checked).map(o => o.label); return on.length ? on.join(', ') : ''; }
    return q.control.tagName === 'SELECT' ? (q.control.selectedOptions[0] && q.control.value ? q.control.selectedOptions[0].text : '') : q.control.value;
  }
  const sentence = t => t ? t.replace(/[.\s]+$/, '') + '. ' : '';
  const spoken = q => `${sentence(q.text)}${sentence(q.hint)}${q.options ? sentence('Options: ' + q.options.map(o => o.label).join('; ')) : ''}${current(q) ? sentence('Your answer: ' + current(q)) : ''}`.trim();

  function applyAnswer(q, alts, form) {
    const name = q.control ? q.control.name : q.inputs[0].name;
    for (const t of alts) {
      if (V.SPECIAL[name]) { const v = V.SPECIAL[name](t); if (v == null) continue;
        if (q.control) { q.control.value = v; q.control.dispatchEvent(new Event('input', { bubbles: true })); q.control.dispatchEvent(new Event('change', { bubbles: true })); return v; }
        const o = q.options.find(o => o.value === v); o.input.checked = true; form.dispatchEvent(new Event('change')); return o.label; }
      if (q.options) {
        const picked = V.match(t, q.options, q.multiple); if (picked == null) continue;
        if (q.control) { q.control.value = picked[0]; form.dispatchEvent(new Event('change')); return q.options.find(o => o.value === picked[0]).label; }
        if (q.multiple && !picked.length) q.options.forEach(o => o.input.checked = false);
        q.options.forEach(o => { if (picked.includes(o.value)) o.input.checked = true; });
        form.dispatchEvent(new Event('change'));
        return picked.length ? q.options.filter(o => picked.includes(o.value)).map(o => o.label).join(', ') : 'none';
      }
      if (q.control.tagName === 'TEXTAREA') { q.control.value = (q.control.value ? q.control.value + ' ' : '') + t; return t; }
      q.control.value = name === 'name' ? t.replace(/^(my name is|i am|i'm|it's)\s+/i, '').replace(/\b\w/g, c => c.toUpperCase()) : t; return q.control.value;
    }
    return null;
  }

  // Mic button state and a visible status line under the question (also announced to screen readers).
  const micState = (b, on) => { b.classList.toggle('listening', on); b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', (on ? 'Stop listening' : 'Answer by voice') + b.dataset.q); };
  function status(q, msg, isError) {
    let el = q.el.querySelector('.vstatus');
    if (!el) { el = document.createElement('p'); el.className = 'vstatus'; el.setAttribute('role', 'status'); q.inputs ? q.head.after(el) : q.el.appendChild(el); }
    el.textContent = msg; el.hidden = !msg; el.classList.toggle('error', !!isError);
  }
  // While listening: what's happening, the words heard so far, and a big Done button to finish.
  function listeningStatus(q, text) {
    status(q, text);
    const el = q.el.querySelector('.vstatus'), done = document.createElement('button');
    done.type = 'button'; done.className = 'donebtn'; done.textContent = 'Done';
    done.setAttribute('aria-label', 'Done speaking'); done.onclick = e => { e.preventDefault(); finishSpeaking(); };
    el.appendChild(done);
  }
  // Finish now: the mic turns off on screen at once; the voice module settles with what it heard.
  function finishSpeaking() {
    document.querySelectorAll('.mic[aria-pressed=true]').forEach(b => micState(b, false));
    document.querySelectorAll('.vstatus .donebtn').forEach(b => { b.disabled = true; b.textContent = 'Finishing…'; });
    V.stopListening();
  }

  function enhanceVoice(form, step) {
    if (!V.canSpeak) return;
    const qs = questions(form);
    qs.forEach(q => {
      const box = document.createElement('span'); box.className = 'vq';
      box.innerHTML = `<button type="button" class="iconbtn sm" aria-label="Hear: ${esc(q.text)}">${ICON.speaker}</button>` +
        (V.canListen ? `<button type="button" class="iconbtn sm mic" data-q=": ${esc(q.text)}" aria-label="Answer by voice: ${esc(q.text)}" aria-pressed="false">${ICON.mic}</button>` : '');
      q.head.appendChild(box);
      const [hear, mic] = box.querySelectorAll('button');
      hear.onclick = e => { e.preventDefault(); V.say(spoken(q)); };
      if (mic) mic.onclick = e => {
        e.preventDefault();
        if (mic.getAttribute('aria-pressed') === 'true') { finishSpeaking(); return; }   // tap again = finish
        endGuide();
        const listening = V.listen({ onReady: () => listeningStatus(q, 'Listening… speak now. Tap Done when you’ve finished.'),
          onInterim: w => listeningStatus(q, `Hearing: “${w}”`) });   // starts inside the tap (Safari needs that)
        micState(mic, true); listeningStatus(q, 'Getting the microphone ready…');
        listening.then(alts => {
          const got = applyAnswer(q, alts, form);
          const msg = got ? `Heard “${alts[0]}”. Answer: ${got}.` : `Heard “${alts[0]}”, but it didn’t match an option.${q.options ? ' You can say: ' + q.options.map(o => o.label).join(', ') + '.' : ''}`;
          status(q, msg, !got); V.say(got ? `Got it: ${got}.` : msg);
        }, err => { const msg = V.explain(err.code); if (msg) { status(q, msg + dictationTip(q), true); V.say(msg); } else status(q, err.code === 'stopped' ? 'Stopped before anything was heard. Tap the microphone to try again.' : ''); })
          .finally(() => micState(mic, false));
      };
    });
    const readAll = () => V.say(`${sentence(step.title)}${sentence(step.sub)}` + qs.filter(q => !q.el.closest('[hidden]')).map(spoken).join(' '));
    const start = () => V.canListen ? guideStep(form, step) : readAll();
    // On opening a step: just the title and how to answer; nothing starts listening until the person asks.
    const intro = () => V.say(`${sentence(step.title)}${sentence(step.sub)}Tap your answers${V.canListen ? ', or tap Listen and answer to answer by voice' : ', or tap Listen to this step to hear the questions'}.`);
    $('#listenStep').onclick = () => guide || V.isSpeaking() ? stopAllVoice() : start();
    $('#autoRead').onclick = () => { SET.autoRead = !SET.autoRead; save(); $('#autoRead').setAttribute('aria-pressed', SET.autoRead); $('#autoRead').textContent = `Read questions aloud: ${SET.autoRead ? 'on' : 'off'}`; SET.autoRead ? intro() : stopAllVoice(); };
    if (SET.voice && SET.autoRead) readSoon(intro);
  }

  // Keyboard dictation works everywhere (including iPhone home-screen apps), so it's the fallback for text answers.
  const dictationTip = q => q.control && q.control.tagName !== 'SELECT' ? ' Or tap the answer box and use the microphone on your keyboard.' : ' You can also tap your answer.';

  // Guided voice for a question step: ask a question, wait for the answer, fill it in, confirm, move on.
  // Say "skip" to leave one blank, "repeat" to hear it again, "stop" to finish. Ends on Stop, Esc or leaving the screen.
  let guide = null;
  const setStepBtn = on => { const b = $('#listenStep'); if (b) { b.lastChild.textContent = on ? ' Stop' : (V.canListen ? ' Listen and answer' : ' Listen to this step'); b.setAttribute('aria-pressed', String(on)); } };
  function endGuide() { if (!guide) return; guide = null; setStepBtn(false); }
  function stopAllVoice() { endGuide(); V.stop(); V.stopListening(); pendingRead = null; speakBar(false); }
  // Watches for the person answering a question by tapping or typing while the guide is running.
  // Multi-choice questions wait a moment in case they tick more than one. Typing stops the mic and waits for the answer.
  let applying = false;   // answers filled in by voice fire change events too: those are not taps
  function watchTap(q) {
    let timer, off;
    const promise = new Promise(res => {
      const own = e => q.el.contains(e.target) && !e.target.closest('.vq, .vstatus') && !applying;
      const onChange = e => { if (!own(e)) return; V.stopListening(); V.stop(); clearTimeout(timer); timer = setTimeout(res, q.multiple ? 2500 : 0, 'tapped'); };
      const onInput = e => { if (own(e)) { V.stopListening(); V.stop(); } };
      q.el.addEventListener('change', onChange); q.el.addEventListener('input', onInput);
      off = () => { clearTimeout(timer); q.el.removeEventListener('change', onChange); q.el.removeEventListener('input', onInput); };
    });
    return { promise, off: () => off() };
  }
  const isOptional = q => /\(optional\)/i.test(q.text);

  // Guided voice for a question step: ask a question, wait for a spoken answer OR a tap, fill it in, confirm, move on.
  // Optional questions ask first whether the person wants to answer. Say "skip", "repeat" or "stop" at any time.
  async function guideStep(form, step) {
    stopAllVoice();
    const me = guide = {}; setStepBtn(true);
    const alive = () => guide === me && document.body.contains(form);
    const sayWait = text => new Promise(res => { if (!SET.voice) return res(); V.say(text, res); });
    const done = new Set();
    const nextQ = () => questions(form).find(q => !done.has(q.el) && !q.el.closest('[hidden]'));
    const words = t => V.norm(t);
    const hear = (q, tap, hint) => {      // listen for an answer, or a tap, whichever comes first
      const mic = q.el.querySelector('.mic'); if (mic) micState(mic, true);
      listeningStatus(q, 'Getting the microphone ready…');
      const l = V.listen({ onReady: () => alive() && listeningStatus(q, hint), onInterim: w => alive() && listeningStatus(q, `Hearing: “${w}”`) });
      return Promise.race([l.then(alts => ({ alts }), err => ({ err })), tap.promise.then(() => ({ tapped: true }))])
        .then(r => { if (r.tapped) V.stopListening(); if (mic) micState(mic, false); return r; });
    };
    const confirmTap = async q => { const c = current(q); status(q, c ? `Answer: ${c}.` : ''); await sayWait(c ? `Got it: ${c}.` : 'Okay.'); };
    await sayWait(`${step.title}. I’ll ask each question and wait for your answer. You can also tap your answers. Say skip to leave one blank, repeat to hear it again, or stop to finish.`);
    for (let q = nextQ(); q && alive(); q = nextQ()) {
      done.add(q.el);
      const tap = watchTap(q);
      try {
        q.el.scrollIntoView({ block: 'center', behavior: SET.motion ? 'auto' : 'smooth' });
        let ask = true, misses = 0;
        // Optional question: offer the choice first.
        if (isOptional(q) && !current(q)) {
          const said = await Promise.race([sayWait(`${sentence(q.text)}This one is optional. Would you like to answer it? Say yes or no, or tap your answer.`), tap.promise]);
          if (!alive()) return; if (said === 'tapped') { await confirmTap(q); continue; }
          const r = await hear(q, tap, 'Listening… say yes or no, or tap your answer.'); if (!alive()) return;
          if (r.tapped) { await confirmTap(q); continue; }
          const t = r.alts ? words(r.alts[0]) : '';
          if (r.err || /^(no|nope|skip|no thanks|not now|leave it)\b/.test(t)) { status(q, 'Skipped'); await sayWait('Okay, skipped.'); continue; }
          if (!/^(yes|yeah|yep|ok|okay|sure|go on)\b/.test(t)) {      // they may have simply given the answer
            applying = true; const got = applyAnswer(q, r.alts, form); applying = false;
            if (got) { status(q, `Heard “${r.alts[0]}”. Answer: ${got}.`); await sayWait(`Got it: ${got}.`); continue; }
          }
        }
        while (alive()) {
          if (ask) { const said = await Promise.race([sayWait(spoken(q)), tap.promise]); if (!alive()) return; if (said === 'tapped') { await confirmTap(q); break; } }
          const r = await hear(q, tap, 'Listening… say your answer, tap it, or say skip. Tap Done when you’ve finished.'); if (!alive()) return;
          if (r.tapped) { await confirmTap(q); break; }
          if (r.err) {
            const err = r.err;
            if (err.code === 'stopped') { status(q, 'Nothing heard. You can tap to answer this one.'); break; }   // tapped Done before speaking
            if (err.code === 'no-speech' && ++misses < 2) { status(q, ''); await sayWait('I didn’t hear anything. Please say your answer now, or tap it.'); ask = false; continue; }
            const msg = err.code === 'no-speech' ? 'I didn’t hear anything, so let’s move on. You can tap to answer this one.' : V.explain(err.code);
            if (msg) status(q, msg + dictationTip(q), true);
            if (err.code === 'no-speech') { await sayWait(msg); break; }
            endGuide(); if (msg) V.say(msg); return;            // blocked mic, no service, etc: stop and show how to fix it
          }
          const alts = r.alts, t = words(alts[0]);
          if (/^(stop|cancel|finish|quit)\b/.test(t)) { status(q, ''); endGuide(); V.say('Stopped. You can carry on by tapping.'); return; }
          if (/^(skip|next|pass|leave it|leave that)\b/.test(t)) { status(q, 'Skipped'); await sayWait('Skipped.'); break; }
          if (/^(repeat|again|say (that|it) again|pardon|sorry|what)\b/.test(t)) { ask = true; continue; }
          if (q.control && q.control.tagName === 'TEXTAREA' && /^(no|nothing|none|no thanks|nope)\b/.test(t)) { status(q, 'Nothing added'); await sayWait('Okay, nothing added.'); break; }
          applying = true; const got = applyAnswer(q, alts, form); applying = false;
          if (got) { status(q, `Heard “${alts[0]}”. Answer: ${got}.`); await sayWait(`Got it: ${got}.`); break; }
          status(q, `Heard “${alts[0]}”, but it didn’t match an option.`, true);
          if (++misses >= 2) { await sayWait('Sorry, I still didn’t catch that. Let’s move on. You can tap to answer this one.'); break; }
          await sayWait(`Sorry, I didn’t catch that.${q.options ? ' You can say: ' + q.options.map(o => o.label).join(', ') + '.' : ''} Or tap your answer.`); ask = false;
        }
      } finally { tap.off(); }
    }
    if (!alive()) return;
    await sayWait('That’s everything on this step. Say continue to go on, or tap Continue.'); if (!alive()) return;
    try {
      const [t] = await V.listen();
      if (alive() && /\b(continue|next|yes|done|carry on|go on|okay|ok)\b/.test(words(t))) { endGuide(); form.querySelector('.sticky .btn').click(); return; }
    } catch { /* no answer: leave them to tap Continue */ }
    endGuide();
  }

  // Browsers only allow speech after the first tap. Until then, auto-reading waits and the bar invites a tap.
  let pendingRead = null;
  const activated = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  function readSoon(fn) {
    if (activated()) { pendingRead = null; setTimeout(fn, 350); return; }
    pendingRead = fn; speakBar('tap');
  }
  // A first tap on empty space starts reading. A first tap on a control (Listen, a link, a switch…) is left to
  // that control, so Listen isn't started and then instantly stopped. The bar's own Start button decides for itself.
  const CONTROL = 'a, button, input, select, textarea, label, summary, [role=button], [role=switch], [role=radio]';
  const startPending = e => {
    if (!pendingRead) return;
    const t = e && e.target && e.target.closest ? e.target : null;
    if (t && t.closest('#speakbar')) return;
    // Leave the bar (and the space it takes) until the tap has finished, so nothing shifts under the finger;
    // then hide it unless that control started reading (Listen) or a new screen already took over.
    if (t && t.closest(CONTROL)) { pendingRead = null; setTimeout(() => { if (!pendingRead && !guide && !(V.isSpeaking && V.isSpeaking())) speakBar(false); }, 700); return; }
    const f = pendingRead; pendingRead = null; speakBar(false); f();
  };
  addEventListener('pointerdown', startPending); addEventListener('keydown', startPending);

  // Reads the current screen: headings, text and list items, skipping the footer.
  // A screen can set exactly what is read (data-readtext), so only the important parts are spoken.
  function readPage() {
    const own = view.querySelector('[data-readtext]');
    if (own) return V.say(own.dataset.readtext);
    const parts = [...view.querySelectorAll('h1, h2, h3, p, li, .because')].filter(el => !el.closest('.foot, .src, nav, .vq, details:not([open]), [data-skipread]') && !el.classList.contains('foot'))
      .map(el => clean(el)).filter(Boolean);
    V.say([...new Set(parts)].map(sentence).join('').trim());
  }

  function renderStep(i) {
    const d = state.draft;
    const s = STEPS[i];
    view.innerHTML = `
      <div class="stepbar">${i ? `<a class="back" href="#step/${i}" id="prev">‹ Back</a>` : '<a class="back" href="#">‹ Back</a>'}
        <div class="progress" aria-hidden="true">${STEPS.map((_, j) => `<span class="${j <= i ? 'on' : ''}"></span>`).join('')}</div><span class="small">${i + 1} of ${STEPS.length}</span></div>
      <h1>${s.title}</h1><p class="sub">${s.sub}</p>
      ${V.canSpeak ? `<div class="voicebar"><button type="button" class="btn sm secondary" id="listenStep" aria-pressed="false">${ICON.speaker} ${V.canListen ? 'Listen and answer' : 'Listen to this step'}</button>
        <button type="button" class="chipbtn" id="autoRead" aria-pressed="${!!SET.autoRead}">Read questions aloud: ${SET.autoRead ? 'on' : 'off'}</button></div>` : ''}
      <form id="step" novalidate style="margin-top:12px">${s.html(d)}<div class="err" id="err" role="alert"></div>
      <div class="sticky"><button class="btn wide">${i === STEPS.length - 1 ? 'See my suggestions' : 'Continue'}</button></div></form>`;
    const form = $('#step');
    enhanceVoice(form, s);
    const sync = () => {
      const ans = readForm(form, d);
      const edu = $('#edu'); if (edu) edu.hidden = !(ans.age >= 16 && ans.age <= 18);
      const who = $('#who'); if (who) who.hidden = ans.fhGlaucomaAny !== 'yes';
    };
    form.addEventListener('change', sync); form.addEventListener('input', sync); sync();
    const pc = form.elements.postcode;
    const checkPostcode = async () => {
      const v = pc.value.trim(), hint = $('#pcHint');
      if (!v) { d.geo = null; return true; }
      if (d.geo && d.geo.postcode.replace(/\s/g, '') === v.toUpperCase().replace(/\s/g, '')) return true;
      hint.textContent = 'Checking postcode…';
      try {
        const g = await window.Near.lookupPostcode(v);
        if (!g) { hint.textContent = 'We couldn’t find that postcode. Check it, or leave it blank.'; return false; }
        d.geo = g; pc.value = g.postcode; window.Near.preload();
        hint.textContent = `Found: ${g.area || g.postcode}. We’ll show opticians near you.`;
        // Offer the country from the postcode; never choose it for them.
        const sel = form.elements.nation;
        if (g.nation && sel.value !== g.nation) {
          const use = document.createElement('button'); use.type = 'button'; use.className = 'chipbtn usenation'; use.textContent = `Use ${L.nation[g.nation]} for the country`;
          use.onclick = () => { sel.value = g.nation; sel.dispatchEvent(new Event('change', { bubbles: true })); use.remove(); };
          hint.append(' ', use);
        }
        return true;
      } catch { d.geo = null; hint.textContent = 'Couldn’t check the postcode right now. You can carry on and add it later.'; return true; }
    };
    if (pc) {
      let t; pc.addEventListener('change', checkPostcode);
      pc.addEventListener('input', () => { clearTimeout(t); if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(pc.value.trim())) t = setTimeout(checkPostcode, 300); });
      if (d.geo) window.Near.preload();
    }
    $('#prev') && ($('#prev').onclick = e => { e.preventDefault(); state.draft = readForm(form, d); save(); location.hash = '#step/' + i; });
    form.onsubmit = async e => {
      e.preventDefault();
      if (pc && !(await checkPostcode())) return;
      const ans = readForm(form, d);
      const err = s.check(ans);
      if (err) { $('#err').textContent = err; return; }
      state.draft = ans; save();
      if (i < STEPS.length - 1) { location.hash = '#step/' + (i + 2); return; }
      const rx = readRx(ans); RX_KEYS.forEach(k => delete ans[k]);
      const prof = derive({ ...ans, completedAt: today() });
      if (state.editing && cur()) { cur().profile = prof; cur().checkins.unshift({ date: today(), profile: prof }); log('New check-in'); }
      else { const id = 'p' + Date.now(); state.people[id] = person(prof); state.current = id; }
      if (rx) { cur().prescriptions.unshift({ ...rx, date: rx.date || today() }); log('Added a prescription'); }
      state.draft = {}; state.editing = false; save(); location.hash = '#home';
    };
  }

  // ---------- shared bits ----------
  const sources = ids => `<ol class="src">${[...new Set(ids)].map(id => M.SOURCES[id]).filter(Boolean).map(s =>
    `<li><span class="org">${esc(s.org)}</span><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ol>`;
  const sourcesCard = ids => `<h2>Sources</h2><div class="card">${sources(ids)}</div>`;
  const CAT = { amsler: 'Self-check', sightTest: 'Checks and screening', des: 'Checks and screening', followUp: 'Ongoing care', smoking: 'Lifestyle', dse: 'At work', contacts: 'Ongoing care', driving: 'Driving' };
  const statusOf = a => a.id === 'amsler' ? (M.amslerDue(cur().amsler).due ? 'Due' : 'Done this week') : cur().arranged[a.id] ? 'Arranged' : a.status;
  const statusTag = s => `<span class="tag ${{ Overdue: 'overdue', 'Due soon': 'due', 'Up to date': 'ok', Arranged: 'ok' }[s] || 'neutral'}">${esc(s)}</span>`;
  const costText = c => ({ free: 'Free', maybe: 'May be free', check: 'May be charged', na: '' }[c.status]);
  const costTag = c => costText(c) ? `<span class="tag ${c.status === 'free' ? 'free' : 'neutral'}">${costText(c)}</span>` : '';
  const foot = '<p class="foot">Concept prototype for a hackathon. Not an NHS service and not medical advice. Information is summarised from the NHS, NICE and GOV.UK pages linked on each screen (checked 26 Sep 2026). In an emergency call 999.</p>';
  const brand = '<div class="pagehead">LOGO<span class="eyepill">EYE_ICON Eye health</span><a class="aa-btn" href="#settings" aria-label="Display and voice settings">Aa</a>AVATAR</div>';
  // The public build sets <html data-brand="neutral">: the NHS logo is a protected trademark, so public copies show an eye mark instead.
  const NHS_LOGO = document.documentElement.dataset.brand !== 'neutral';
  const PRIORITY = { Due: 0.5, 'Done this week': 6.5, Overdue: 0, 'Due soon': 1, 'By invitation': 2, Ongoing: 3, Optional: 4, Info: 5, 'Up to date': 6, Arranged: 7 };
  const actionCard = a => `<a class="card" href="#action/${a.id}"><span class="tag">${CAT[a.id]}</span>${statusTag(statusOf(a))}${costTag(a.cost)}
    <h3>${esc(a.title)}</h3><p class="sub" style="margin:0">${esc(a.freq)}</p></a>`;
  const back = (href, label = 'Back') => `<a class="back" href="${href}">‹ ${label}</a>`;
  const progressCard = (acts, extra = '') => {
    const done = acts.filter(a => cur().arranged[a.id]).length;
    return `<div class="card green"><h3>${extra || 'Your progress'}</h3>
      <p class="sub" style="margin:0">You have arranged ${done} of ${acts.length} recommended steps. Everything here is a suggestion, so go at your own pace.</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${acts.length}" aria-valuenow="${done}" aria-label="Steps arranged"><span style="width:${acts.length ? done / acts.length * 100 : 0}%"></span></div></div>`;
  };

  const safeUrl = u => /^https?:\/\//i.test(u) ? u : '';
  const nearSlot = (p, n) => p.geo ? `<div class="nearlist" data-max="${n}"><div class="card"><p class="sub" style="margin:0">Finding opticians near ${esc(p.geo.postcode)}…</p></div></div>`
    : `<a class="card tint" href="#edit" style="display:block;text-decoration:none;color:inherit"><h3>See opticians near you</h3><p class="sub" style="margin:0">Add your postcode in your answers and we’ll list places nearby.</p></a>`;
  async function fillNear(p) {
    const slots = view.querySelectorAll('.nearlist'); if (!slots.length || !p.geo) return;
    const nhs = M.NATIONS[p.nation].services[0];
    let list;
    try { list = await window.Near.opticians(p.geo); } catch { list = null; }
    slots.forEach(el => {
      if (!document.body.contains(el)) return;
      if (!list || !list.length) { el.innerHTML = `<div class="card"><p class="sub" style="margin:0">${list ? 'No opticians found nearby in OpenStreetMap.' : 'Couldn’t load nearby places right now.'} Use the NHS finder instead.</p></div><a class="linkrow" href="${nhs.url}" target="_blank" rel="noopener"><span>${esc(nhs.label)}<span class="small">${esc(nhs.note)} · search ${esc(p.geo.postcode)}</span></span></a>`; return; }
      el.innerHTML = list.slice(0, +el.dataset.max).map(o => {
        const web = safeUrl(o.website);
        return `<div class="card place"><div class="placehead"><h3>${esc(o.name)}</h3><span class="tag neutral">${o.dist < 0.1 ? '<0.1' : o.dist.toFixed(1)} mi</span></div>
          ${o.address ? `<p class="small" style="margin:0 0 8px">${esc(o.address)}</p>` : ''}
          <div class="placeacts">${web ? `<a class="btn sm" href="${esc(web)}" target="_blank" rel="noopener">Book or visit site ↗</a>` : `<a class="btn sm" href="https://www.google.com/search?q=${encodeURIComponent(o.name + ' ' + (o.address || p.geo.area) + ' book eye test')}" target="_blank" rel="noopener">Find how to book ↗</a>`}
          ${o.phone ? `<a class="btn sm secondary" href="tel:${esc(o.phone.replace(/[^+\d]/g, ''))}">Call</a>` : ''}
          <a class="btn sm secondary" href="${esc(o.map)}" target="_blank" rel="noopener">Map ↗</a></div></div>`;
      }).join('') + `<p class="small">Listings from OpenStreetMap. When you book, ask whether they do NHS sight tests.</p>`;
    });
  }

  function banner(p) {
    const u = M.urgent(p); if (!u) return '';
    const n = M.NATIONS[p.nation];
    const what = u.level === 'emergency' ? 'Call 999 or go to A&E now. Do not drive yourself.' : n.urgent + ' In an emergency call 999.';
    return `<div class="notice ${u.level}"><strong>About what you told us</strong>
      <p>You ticked: ${u.items.map(esc).join('; ')}. NHS guidance for these says: ${what}</p>
      <p class="small" style="margin:0">If this has already been checked, you can untick it in your answers.</p>
      <details><summary>Sources</summary>${sources(u.src)}</details></div>`;
  }

  // ---------- screens ----------
  const brandHtml = () => brand.replace('LOGO', logo()).replace('EYE_ICON', EYE()).replace('AVATAR', cur() ? `<a class="avatar" href="#profile" aria-label="Your profile">${esc(initial(cur().profile))}</a>` : '');
  // The Clear Sight Companion mark (brand/logo-mark.svg): the app's eye with a green smile beneath it.
  const MARK = px => `<svg width="${px}" height="${px}" viewBox="0 0 120 120" role="img" aria-label="Clear Sight Companion"><path d="M10 56 Q60 8 110 56 Q60 104 10 56 Z" fill="#fff" stroke="#0B1F33" stroke-width="7" stroke-linejoin="round"/><circle cx="60" cy="56" r="22" fill="#005EB8"/><circle cx="60" cy="56" r="22" fill="none" stroke="#003D78" stroke-width="3"/><circle cx="60" cy="56" r="10" fill="#0B1F33"/><circle cx="67.5" cy="48.5" r="4.6" fill="#fff"/><path d="M28 96 Q60 114 92 96" fill="none" stroke="#2E9E6E" stroke-width="7" stroke-linecap="round"/></svg>`;
  const logo = big => NHS_LOGO ? `<span class="nhs${big ? ' big' : ''}" aria-label="NHS">NHS</span>` : `<span class="mark${big ? ' big' : ''}">${MARK(big ? 64 : 40)}</span>`;
  const EYE = (w = 18) => `<svg width="${w}" height="${w * .6}" viewBox="0 0 30 18" aria-hidden="true"><path d="M1 9 Q15 -4 29 9 Q15 22 1 9Z" fill="#fff" stroke="#003D78" stroke-width="2"/><circle cx="15" cy="9" r="5.5" fill="#005EB8"/><circle cx="15" cy="9" r="2.6" fill="#0B1F33"/><circle cx="17" cy="7" r="1.2" fill="#fff"/></svg>`;
  const HILLS = `<svg viewBox="0 0 400 170" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
    <circle cx="330" cy="40" r="22" fill="#fff"/><circle cx="58" cy="118" r="10" fill="#fff" opacity=".8"/>
    <path d="M0 110 C70 80 130 90 200 106 S330 130 400 96 V170 H0Z" fill="#BFD6EE"/>
    <path d="M0 128 C80 104 150 116 230 130 S340 144 400 124 V170 H0Z" fill="#A8D5BF"/>
    <path d="M0 146 C90 132 170 140 260 150 S360 156 400 146 V170 H0Z" fill="#7FBFA4"/>
    <g transform="translate(200 78)"><g class="blink">
      <path d="M-82 0 Q0 -58 82 0 Q0 58 -82 0Z" fill="#fff" stroke="#0B1F33" stroke-width="5" stroke-linejoin="round"/>
      <g class="iris"><circle r="30" fill="#2F7BD0"/><circle r="30" fill="none" stroke="#003D78" stroke-width="3"/>
      <circle r="15" fill="#0B1F33"/><circle cx="10" cy="-10" r="6" fill="#fff"/></g></g></g></svg>`;

  function welcome() {
    const people = Object.entries(state.people);
    const readText = `Clear Sight Companion. Your personal eye health assistant. Answer a few short questions to see which NHS eye checks apply to you, and why. Tap Get started to begin${people.length ? ', or choose your name to continue' : ''}.`;
    return `<p hidden data-readtext="${esc(readText)}"></p><div class="hero"><div class="herotext">${logo(true)}<p class="eyebrow">Eye health${NHS_LOGO ? '' : ' · based on NHS and NICE guidance'}</p><h1>Clear Sight Companion</h1>
        <p class="sub">Your personal eye health assistant. Find out which NHS eye checks apply to you, and why.</p>
        ${NHS_LOGO ? '' : '<p class="small">Independent concept prototype. Not an NHS service.</p>'}</div>${HILLS}</div>
      <div class="sheet">
      <div class="split"><div>
        <h2 style="margin-top:0">Let’s get started</h2>
        <p class="sub">Answer a few short sections. You get eye health suggestions matched to you, with links to the NHS and NICE pages behind them.</p>
        <ol class="steps"><li>Tell us a little about you and your eyes</li><li>See what’s recommended, and why</li><li>Keep your records and progress in one place</li></ol>
        <div class="navrow"><a class="btn wide" href="#new">Get started</a></div>
        <p class="small" style="margin-top:10px">About 3 minutes. Your answers stay on this device.</p>
        <a class="linkrow internal" href="#settings"><span>Display and voice<span class="small">Bigger text, high contrast, read aloud</span></span></a>
        <a class="linkrow internal" href="?demo=amara"><span>Just looking? Try a demo profile<span class="small">Amara, 47: diabetes and a parent with glaucoma</span></span></a></div>
      ${people.length ? `<div><h2 style="margin-top:0">Or continue as</h2>${people.map(([id, x]) => `<a class="linkrow internal" href="#switch/${id}"><span><span class="avatar sm">${esc(initial(x.profile))}</span> ${esc(x.profile.name || 'Unnamed profile')}<span class="small">Last check-in ${fmt(x.profile.completedAt)}</span></span></a>`).join('')}</div>` : ''}</div>
      <h2>The problem</h2>
      <div class="card tint"><p style="margin:0">Many people don’t know which NHS eye checks they’re entitled to, or why they matter. Glaucoma often has no symptoms at first and is often picked up at a routine eye test (NHS).</p></div>
      <h2>Who it’s for</h2>
      <div class="cards three">
        <div class="card"><h3>Lower risk</h3><p class="sub" style="margin:0">Check in whenever you like, with sight tests as the NHS advises.</p></div>
        <div class="card green"><h3>Higher risk</h3><p class="sub" style="margin:0">Family history, diabetes, age or smoking change what’s suggested.</p></div>
        <div class="card tint"><h3>Living with an eye condition</h3><p class="sub" style="margin:0">Keep follow-ups, records and progress together.</p></div></div>
      <h2>What it won’t do</h2>
      <div class="card"><ul class="plain"><li>Diagnose, or give medical advice</li><li>Book appointments. It links to official NHS finders</li><li>Send your answers anywhere. They stay on this device (only a postcode, if you add one, is used to find places nearby)</li></ul>
        <p class="small" style="margin:8px 0 0">If you have sudden loss of vision or sudden severe eye pain, call 999.</p></div>
      <a class="linkrow internal urgentrow" href="#urgent"><span>Urgent or emergency eye help<span class="small">What to do and who to call</span></span></a>
      ${foot}</div>`;
  }

  function home(p) {
    const acts = M.actions(p);
    const h = new Date().getHours();
    const hello = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + (p.name ? ', ' + esc(p.name) : '');
    const top = [...acts].sort((a, b) => (PRIORITY[statusOf(a)] ?? 9) - (PRIORITY[statusOf(b)] ?? 9)).slice(0, 3);
    const mention = acts[0].mention;
    const tile = (href, t, s) => `<a class="card" href="${href}"><h3>${t}</h3><span class="small">${s}</span></a>`;
    return `${brandHtml()}<h1>${hello}</h1><p class="sub">Your personalised eye health hub</p>${banner(p)}
      ${progressCard(acts, 'Your eye health plan').replace('</div></div>', `</div><p class="small" style="margin:8px 0 0">Last check-in ${fmt(p.completedAt)} · <a href="#edit">Check in again</a> whenever something changes</p></div>`)}
      ${amslerCard(p)}
      <div class="grid2">${tile('#records/timeline', 'Your journey', 'What you have done so far')}${tile('#records/rx', 'Prescriptions', p.rx ? rxDesc(p.rx) + ' · ' + fmt(p.rx.date) : 'Add yours for better suggestions')}
        ${tile('#nearby', 'Nearby', 'Services for your suggestions')}${tile('#learn', 'Learn', 'Guides matched to you')}</div>
      <h2>Recommended for you <a class="more" href="#foryou">View all ${acts.length} ›</a></h2><div class="cards">${top.map(actionCard).join('')}</div>
      ${mention.length ? `<h2>To mention at your sight test</h2><div class="card tint"><ul class="plain">${mention.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
      ${foot}`;
  }

  // ---------- Amsler grid ----------
  const amslerFor = p => p.conditions && p.conditions.includes('amd') ? 'Recommended weekly because you have AMD' : p.fhAMD ? 'Useful because AMD runs in your family' : 'An optional 1-minute check of your central vision';
  function amslerCard(p) {
    const d = M.amslerDue(cur().amsler), last = (cur().amsler || [])[0];
    return `<a class="card checkcard" href="#amsler"><div class="checkicon" aria-hidden="true">${amslerSVG(false, 44)}</div><div>
      <span class="tag ${d.due ? 'due' : 'ok'}">${d.due ? (last ? 'Due' : 'Try it') : 'Done this week'}</span><h3>Amsler grid check</h3>
      <span class="small">${last ? `Last done ${d.days === 0 ? 'today' : d.days === 1 ? 'yesterday' : d.days + ' days ago'}` : esc(amslerFor(p))}</span></div></a>`;
  }
  // 20 × 20 squares with a centre dot, like the printed chart. dark = white lines on black (the original style).
  function amslerSVG(dark, px) {
    const fg = dark ? '#fff' : '#000', bg = dark ? '#000' : '#fff'; let lines = '';
    for (let i = 0; i <= 20; i++) { const v = i * 10, w = i % 20 === 0 ? 1.6 : 0.8; lines += `<path d="M${v} 0V200M0 ${v}H200" stroke="${fg}" stroke-width="${w}"/>`; }
    return `<svg viewBox="0 0 200 200" ${px ? `width="${px}" height="${px}"` : ''} role="img" aria-label="Amsler grid: a square of straight lines with a dot in the centre"><rect width="200" height="200" fill="${bg}"/>${lines}<circle cx="100" cy="100" r="3.2" fill="${fg}"/></svg>`;
  }
  function amslerIntro(p) {
    const hist = cur().amsler || [], d = M.amslerDue(hist);
    return `${back('#home', 'Home')}<h1>Amsler grid check</h1><p class="sub">A 1-minute check of your central vision, one eye at a time. ${esc(amslerFor(p))}.</p>
      <div class="card checkhero">${amslerSVG(false, 120)}<div>
        <p style="margin:0 0 8px"><strong>${hist.length ? `Last check: ${fmt(hist[0].date)}` : 'You haven’t done a check yet.'}</strong><br><span class="small">${d.due ? 'Due now. Once a week is a good routine.' : `Next check due in ${7 - d.days} day${7 - d.days === 1 ? '' : 's'}.`}</span></p>
        <a class="btn wide" href="#amsler/test/re">Start the check</a></div></div>
      <button type="button" class="btn secondary wide" id="amslerReminder">Add a weekly reminder to my calendar</button>
      <h2>Why this check is here</h2>
      <div class="card"><ul class="plain">
        <li>Age-related macular degeneration (AMD) affects the middle of your vision. The NHS lists straight lines looking wavy or crooked as one of its symptoms.</li>
        <li>In wet AMD, abnormal blood vessels leak into the macula and can cause rapid loss of central vision. Treatment works best when it starts quickly (Macular Society).</li>
        <li>NICE advises people with AMD to report straight lines that look distorted, a blurred or grey patch, or objects looking smaller than normal as soon as possible.</li>
        <li>Looking at the same grid each week makes a new change easier to notice.</li></ul></div>
      <h2>How to do it on your phone</h2>
      <div class="card"><ol class="steps">
        <li>Find good light and turn your screen brightness up.</li>
        <li>Wear your usual reading glasses if you have them.</li>
        <li>Hold the phone about 30 cm from your face, roughly the length of a school ruler.</li>
        <li>Cover one eye with your hand, without pressing on it.</li>
        <li>Look only at the dot in the middle. Without moving your eye, notice whether any lines look wavy, blurred, missing or dark.</li>
        <li>Do the same with your other eye.</li></ol>
        <p class="small" style="margin:8px 0 0">Instructions follow an NHS eye clinic’s guidance (Cambridge University Hospitals): reading glasses, about 30 cm, good light, one eye at a time, look at the centre dot, once a week.</p></div>
      <h2>Good to know</h2>
      <div class="card tint"><ul class="plain">
        <li>This is a self-check, not a diagnosis. It doesn’t replace sight tests. NICE advises people with AMD to keep going to routine sight tests.</li>
        <li>A phone screen is smaller than a printed grid. If your eye clinic gave you a paper grid, keep using that too.</li>
        <li>If lines have looked a certain way for a while and your eye team knows, look for anything <strong>new or worse</strong>.</li></ul></div>
      ${hist.length ? `<h2>Your checks</h2><div class="card"><ul class="tl">${hist.slice(0, 12).map(h => `<li><span class="small">${fmt(h.date)}</span><strong>Right: ${h.re === 'ok' ? 'looked normal' : 'change noticed'} · Left: ${h.le === 'ok' ? 'looked normal' : 'change noticed'}</strong></li>`).join('')}</ul></div>` : ''}
      ${sourcesCard(['cuhAMD', 'macSocAMD', 'nhsAMDSymptoms', 'niceNG82'])}${foot}`;
  }
  let run = { re: null, le: null, marks: { re: [], le: [] } };
  const EYES = { re: { name: 'Right eye', cover: 'LEFT', next: 'le' }, le: { name: 'Left eye', cover: 'RIGHT', next: null } };
  function amslerTest(eye) {
    const e = EYES[eye]; if (!e) return notFound();
    if (eye === 're') run = { re: null, le: null, marks: { re: [], le: [] } };
    return `<div class="amsler ${SET.amslerDark ? 'dark' : ''}">
      <div class="amslertop"><a class="back" href="#amsler">‹ Stop</a><span class="small">${eye === 're' ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
        <button type="button" class="chipbtn" id="amslerInvert" aria-pressed="${!!SET.amslerDark}">${SET.amslerDark ? 'Black lines on white' : 'White lines on black'}</button></div>
      <h1>${e.name}: cover your ${e.cover} eye</h1>
      <p class="amslerhint">Hold the phone about 30 cm away. Look only at the dot in the middle.</p>
      <div class="gridwrap" id="gridwrap">${amslerSVG(!!SET.amslerDark)}</div>
      <p class="amslerq">Keeping your eye on the dot: are all the lines straight, with no wavy, blurred, missing or dark areas? Can you see all four corners?</p>
      <div class="amslerbtns" id="amslerAnswer">
        <button type="button" class="btn big" data-ans="ok">Yes, all straight and complete</button>
        <button type="button" class="btn big secondary" data-ans="change">No, something looks different</button></div>
      <div id="amslerMark" hidden><p class="amslerq"><strong>Tap the grid where it looks different</strong> (optional). This can help when you talk to your optician.</p>
        <div class="amslerbtns"><button type="button" class="btn big" id="markDone">Done</button><button type="button" class="btn secondary" id="markClear">Clear marks</button></div></div></div>`;
  }
  function amslerResult() {
    if (!run.re || !run.le) return amslerIntro(viewP());
    const changed = ['re', 'le'].filter(k => run[k] === 'change'), n = M.NATIONS[viewP().nation];
    const eyeName = k => k === 're' ? 'right' : 'left';
    return `${back('#amsler', 'Amsler grid')}<h1>${changed.length ? 'You noticed a change' : 'Both eyes looked normal'}</h1>
      <p class="sub">Saved to your records, ${fmt(today())}.</p>
      <div class="glance" style="grid-template-columns:1fr 1fr">${['re', 'le'].map(k => `<div class="card ${run[k] === 'ok' ? 'green' : 'warn'}"><span class="small">${k === 're' ? 'Right eye' : 'Left eye'}</span><strong>${run[k] === 'ok' ? 'Looked normal' : 'Something looked different'}</strong>${run.marks[k].length ? `<div class="markgrid">${markedGrid(k)}</div>` : ''}</div>`).join('')}</div>
      ${changed.length ? `<div class="card">
        <h3>What to do next</h3>
        <p>If what you saw in your ${changed.map(eyeName).join(' and ')} eye is <strong>new, or worse than before</strong>, contact an optician or your eye clinic <strong>as soon as possible</strong> and tell them what you noticed. NICE advises reporting changes like this as soon as possible.</p>
        <p>If your vision has <strong>suddenly got worse</strong>, you see a dark curtain or shadow, or your eye is red and painful: ${esc(n.urgent)}</p>
        <p class="small" style="margin:0">If it looks the same as your last check and your eye team already knows about it, keep checking once a week.</p></div>
        <a class="btn wide" href="#nearby">Find an optician near you</a>
        <a class="linkrow internal" href="#urgent" style="margin-top:8px"><span>Urgent or emergency eye help</span></a>
        <a class="linkrow" href="tel:03003030111"><span>Call the Macular Society helpline<span class="small">0300 3030 111 · Monday to Friday, 9am to 5pm</span></span></a>`
      : `<div class="card green"><p style="margin:0">Keep checking once a week. If you ever notice wavy, blurred, missing or dark areas that are new, contact an optician as soon as possible.</p></div>
        <a class="btn wide" href="#home">Back to home</a>`}
      ${sourcesCard(['niceNG82', 'nhsAMDSymptoms', 'cuhAMD', 'macSocHelp'])}${foot}`;
  }
  function markedGrid(k) { return amslerSVG(false, 96).replace('</svg>', run.marks[k].map(([x, y]) => `<circle cx="${x * 200}" cy="${y * 200}" r="9" fill="none" stroke="#C0392B" stroke-width="3"/>`).join('') + '</svg>'); }
  function wireAmsler(eye) {
    const inv = $('#amslerInvert'); if (inv) inv.onclick = () => { SET.amslerDark = !SET.amslerDark; save(); route(); };
    const rem = $('#amslerReminder'); if (rem) rem.onclick = downloadReminder;
    const ans = $('#amslerAnswer'); if (!ans) return;
    const e = EYES[eye], finish = () => { location.hash = e.next ? '#amsler/test/' + e.next : '#amsler/result'; };
    ans.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => {
      run[eye] = b.dataset.ans; V.stop();
      if (b.dataset.ans === 'ok') return finish();
      ans.hidden = true; $('#amslerMark').hidden = false; V.say('Tap the grid where it looks different, then tap Done.');
      const wrap = $('#gridwrap'); wrap.classList.add('marking');
      wrap.onclick = ev => { const r = wrap.querySelector('svg').getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        if (x < 0 || y < 0 || x > 1 || y > 1) return; run.marks[eye].push([+x.toFixed(3), +y.toFixed(3)]);
        wrap.querySelector('svg').insertAdjacentHTML('beforeend', `<circle cx="${x * 200}" cy="${y * 200}" r="9" fill="none" stroke="#C0392B" stroke-width="3"/>`); };
      $('#markClear').onclick = () => { run.marks[eye] = []; wrap.querySelectorAll('circle[stroke="#C0392B"]').forEach(c => c.remove()); };
      $('#markDone').onclick = finish;
    });
    const instructions = `${e.name}. Cover your ${e.cover.toLowerCase()} eye with your hand, without pressing. Hold the phone about 30 centimetres away. Look only at the dot in the middle. Keeping your eye on the dot, are all the lines straight, with no wavy, blurred, missing or dark areas? Can you see all four corners? Tap yes, or tap no if something looks different.`;
    if (SET.voice) readSoon(() => V.say(instructions));
  }
  function saveAmsler() {
    const c = cur(); c.amsler ||= [];
    if (!run.re || !run.le || run.saved) return;
    c.amsler.unshift({ date: today(), re: run.re, le: run.le, marks: run.marks }); run.saved = true;
    const changed = ['re', 'le'].filter(k => run[k] === 'change').map(k => k === 're' ? 'right' : 'left');
    log(changed.length ? `Amsler grid check: change noticed in ${changed.join(' and ')} eye` : 'Amsler grid check: both eyes looked normal'); save();
  }
  // A weekly all-day calendar event with a 10am alert: works with Apple, Google and Outlook calendars, no server needed.
  function downloadReminder() {
    const d = new Date(Date.now() + 7 * 864e5), ymd = d.toISOString().slice(0, 10).replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clear Sight Companion//EN', 'BEGIN:VEVENT', `UID:csc-amsler-${Date.now()}@clear-sight-companion`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`, 'RRULE:FREQ=WEEKLY', 'SUMMARY:Amsler grid check (Clear Sight Companion)',
      'DESCRIPTION:A 1-minute check of your central vision. Open https://clear-sight-companion.vercel.app/#amsler',
      'BEGIN:VALARM', 'TRIGGER:PT10H', 'ACTION:DISPLAY', 'DESCRIPTION:Amsler grid check', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'amsler-weekly-reminder.ics'; document.body.appendChild(a); a.click(); a.remove();
    const b = $('#amslerReminder'); if (b) b.textContent = 'Reminder file downloaded: open it to add to your calendar';
  }

  // ---------- urgent and emergency eye help ----------
  function urgentPage(p) {
    const nk = (p && p.nation) || state.urgentNation || null, n = nk ? M.NATIONS[nk] : null;
    return `${back(p ? '#nearby' : '#', p ? 'Nearby' : 'Back')}<h1>Urgent and emergency eye help</h1><p class="sub">What NHS guidance says to do${n ? `, and who to contact in ${esc(n.name)}` : ''}.</p>
      ${p ? '' : `${n ? '' : '<p class="small" style="margin:8px 0 4px"><strong>Where do you live?</strong> Choose to see who to contact.</p>'}<div class="seg four-nations" role="radiogroup" aria-label="Where you live">${Object.entries(M.NATIONS).map(([k, x]) => `<button type="button" role="radio" aria-checked="${k === nk}" data-nation="${k}">${esc(x.name)}</button>`).join('')}</div>`}
      <div class="card helpcard emergency"><h2>Call 999 or go to A&amp;E</h2>
        <ul class="plain"><li>Sudden loss of vision in one or both eyes</li><li>Sudden, severe eye pain</li><li>A strong chemical in your eye, such as bleach or oven cleaner</li><li>Something has pierced your eye, or hit it at high speed</li></ul>
        <p class="small">Don’t drive yourself: ask someone to take you, or call 999 for an ambulance.</p>
        <div class="helpacts"><a class="btn" href="tel:999">Call 999</a>${n ? `<a class="btn secondary" href="${n.ae.url}" target="_blank" rel="noopener">${esc(n.ae.label)} ↗</a>` : ''}</div></div>
      <div class="card"><h3>Chemical in your eye</h3><p style="margin:0">Keep rinsing your eye with clean water for at least 20 minutes while you wait for help, and take the container with you (NHS).</p></div>
      <div class="card helpcard"><h2>Get help the same day</h2>
        <ul class="plain"><li>New floaters or flashes, or a sudden increase in them</li><li>A dark shadow or “curtain” moving across your vision</li><li>A red, painful eye</li><li>Sudden blurred or double vision</li><li>Your vision suddenly gets worse</li></ul>
        ${n ? `<p><strong>${esc(n.urgent)}</strong></p>` : '<p><strong>Choose where you live at the top of this page to see who to contact.</strong></p>'}
        <div class="helpacts">${(n ? n.urgentActs : []).map((x, i) => `<a class="btn ${i ? 'secondary' : ''}" href="${x.href}" ${x.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(x.label)}${x.href.startsWith('http') ? ' ↗' : ''}</a>`).join('')}
          ${p ? '<a class="btn secondary" href="#nearby">Opticians near you</a>' : ''}</div></div>
      <h2>Support and advice</h2>
      <a class="linkrow" href="tel:03003030111"><span>Macular Society helpline<span class="small">0300 3030 111 · Monday to Friday, 9am to 5pm</span></span></a>
      <a class="linkrow" href="tel:03031239999"><span>RNIB helpline (sight loss support)<span class="small">0303 123 9999 · Monday to Friday, 9am to 5pm</span></span></a>
      <p class="small">This page doesn’t assess symptoms. If you’re unsure, contact the services above.</p>
      ${sourcesCard(['nhsVisionLoss', 'nhsFloaters', 'nhsEyeInjury', 'nhsAMDSymptoms', 'nhsWhenAE', ...(nk === 'ni' ? ['niUrgent'] : []), 'macSocHelp', 'rnibHelp'])}${foot}`;
  }

  function forYou(p) {
    return `${banner(p)}<h1>For you</h1><p class="sub">What NHS guidance suggests for someone with your answers. Tap one to see why it’s here and how to arrange it.</p>
      <div class="cards" style="margin-top:12px">${M.actions(p).map(actionCard).join('')}</div>${foot}`;
  }

  function actionDetail(p, id) {
    const a = M.actions(p).find(x => x.id === id); if (!a) return notFound();
    const n = M.NATIONS[p.nation];
    const arranged = cur().arranged[id];
    const costLine = a.cost.reasons.length ? `${costText(a.cost)}: ${a.cost.reasons.map(esc).join('; ')}.` : a.cost.status === 'check' ? 'You may be charged. Ask the practice.' : '';
    const links = ['sightTest', 'contacts'].includes(id) ? n.services.slice(0, 1) : ['des', 'followUp'].includes(id) ? n.services.slice(0, 2) : [];
    return `${back('#foryou')}<div><span class="tag">${CAT[id]}</span>${statusTag(statusOf(a))}${costTag(a.cost)}</div>
      <h1>${esc(a.title)}</h1><p class="sub">${esc(a.freq)}${arranged ? ` · arranged ${fmt(arranged)}` : ''}</p>
      <div class="card"><h3>How to arrange it</h3><p class="small" style="margin:0">Done with the NHS service, not in this app.</p><ol class="steps">${a.arrange.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
      ${['sightTest', 'contacts'].includes(id) ? `<h2>Opticians near you ${p.geo ? `<a class="more" href="#nearby">See more ›</a>` : ''}</h2>${nearSlot(p, 3)}<h2>Or use the NHS tool</h2>` : ''}
      ${links.map(s => `<a class="linkrow" href="${s.url}" target="_blank" rel="noopener"><span>${esc(s.label)}<span class="small">${esc(s.note)}${p.geo ? ' · search ' + esc(p.geo.postcode) : ''}</span></span></a>`).join('')}
      ${id === 'amsler' ? `<a class="btn wide" href="#amsler">Start the Amsler grid check</a>` : `<button class="btn wide ${arranged ? 'secondary' : ''}" id="toggleArranged">${arranged ? 'Arranged ✓ · tap to undo' : 'Mark as arranged'}</button>`}
      <h2>Why this is here</h2><div class="card"><ul class="plain">${a.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${costLine ? `<p class="small" style="margin:8px 0 0"><strong>Cost:</strong> ${costLine}</p>` : ''}</div>
      ${a.mention && a.mention.length ? `<h2>To mention</h2><div class="card tint"><ul class="plain">${a.mention.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
      ${a.learn.length ? `<h2>Read more</h2>${a.learn.map(t => `<a class="linkrow internal" href="#topic/${t}">${esc(M.TOPICS[t].title)}</a>`).join('')}` : ''}
      ${sourcesCard(a.src)}${foot}`;
  }

  function learnTab(p) {
    return `<h1>Learn</h1><p class="sub">Guides picked for your answers. Each one links to its NHS or NICE source.</p>
      <div class="cards" style="margin-top:12px">${M.learn(p).map(t => `<a class="card" href="#topic/${t.id}"><h3>${esc(t.title)}</h3><span class="because">Shown because ${esc(t.because)}</span></a>`).join('')}</div>${foot}`;
  }

  function topicDetail(p, id) {
    const t = M.TOPICS[id]; if (!t) return notFound();
    const because = t.when(p);
    return `${back('#learn', 'Learn')}<h1>${esc(t.title)}</h1>${because ? `<p class="because">Shown because ${esc(because)}</p>` : ''}
      <div class="card">${t.body.map(b => `<p>${esc(b)}</p>`).join('')}</div>
      <div class="card tint"><p class="small" style="margin:0">This is general information, not advice about you. For that, speak to an optician, pharmacist or GP.</p></div>
      ${sourcesCard(t.src)}${foot}`;
  }

  function nearby(p) {
    const n = M.NATIONS[p.nation];
    return `<h1>Nearby</h1><p class="sub">${p.geo ? `Around ${esc(p.geo.postcode)}${p.geo.area ? ', ' + esc(p.geo.area) : ''}` : 'Places and services for your suggestions'}. Booking happens with the practice, not in this app.</p>
      <a class="linkrow internal urgentrow" href="#urgent"><span>Urgent or emergency eye help<span class="small">What to do, who to call, A&amp;E and helplines for ${esc(n.name)}</span></span></a>
      <h2>Opticians near you</h2>${nearSlot(p, 6)}
      <h2>NHS tools for ${esc(n.name)}</h2>
      ${n.services.map(s => `<a class="linkrow" href="${s.url}" target="_blank" rel="noopener"><span>${esc(s.label)}<span class="small">${esc(s.note)}</span></span></a>`).join('')}
      <div class="card" style="margin-top:12px"><h3>If you need help sooner</h3><p class="sub" style="margin:0">${esc(n.urgent)}</p></div>
      ${sourcesCard(['nhsOptician', n.costSource])}${foot}`;
  }

  function records(p, sub) {
    const tabs3 = [['', 'Documents'], ['rx', 'Prescriptions'], ['timeline', 'Timeline']];
    const seg = `<div class="seg three" role="tablist">${tabs3.map(([k, t]) => `<a href="#records${k ? '/' + k : ''}" role="tab" aria-selected="${(sub || '') === k}">${t}</a>`).join('')}</div>`;
    const head = `<h1>Records and journey</h1>${seg}`;
    const c = cur();
    if (sub === 'timeline') return `${head}${progressCard(M.actions(p))}<h2>What has happened</h2>
      ${c.events.length ? `<ul class="tl">${c.events.map(e => `<li><span class="small">${fmt(e.date)}</span><strong>${esc(e.text)}</strong></li>`).join('')}</ul>` : '<p class="sub">Nothing yet.</p>'}${foot}`;
    if (sub === 'rx') {
      const rxs = c.prescriptions;
      const change = (a, b, k) => { const x = parseFloat(a[k] && a[k].sph), y = parseFloat(b[k] && b[k].sph); return Number.isFinite(x) && Number.isFinite(y) && x !== y ? `${k === 're' ? 'Right' : 'Left'} ${sign(String(x - y))}` : ''; };
      return `${head}<p class="small">Your latest prescription is used in your suggestions. It stays on this device.</p>
      <details class="card tint" ${rxs.length ? '' : 'open'}><summary class="btn wide" style="list-style:none">Add a prescription</summary>
        <form id="addRx" style="margin-top:12px">${rxFields({ date: today() })}<div class="err" id="rxErr" role="alert"></div><button class="btn wide">Save prescription</button></form></details>
      ${rxs.map((rx, i) => { const prev = rxs[i + 1]; const ch = prev ? [change(rx, prev, 're'), change(rx, prev, 'le')].filter(Boolean).join(', ') : '';
        return `<div class="card"><div class="placehead"><div>${i === 0 ? '<span class="tag ok">Latest</span>' : ''}<span class="tag neutral">${esc(rxDesc(rx))}</span><h3>${fmt(rx.date)}</h3></div>
          <button class="iconbtn" data-delrx="${i}" aria-label="Delete prescription from ${fmt(rx.date)}">✕</button></div>${rxTable(rx)}${attachment(rx.file)}
          ${ch ? `<p class="small" style="margin:8px 0 0">Sphere change since ${fmt(prev.date)}: ${ch}</p>` : ''}</div>`; }).join('')}
      ${rxs.length ? `<div class="card tint"><p class="small" style="margin:0">Changes in your prescription are for your optician to interpret. This app doesn’t judge whether a change matters.</p></div>` : ''}${foot}`;
    }
    return `${head}<p class="small">Records stay on this device. Nothing is saved online or sent anywhere.</p>
      <details class="card tint" id="addBox"><summary class="btn wide" style="list-style:none">Add a record</summary>
        <form id="addRecord" style="margin-top:12px">
          <label class="field"><span>Type</span><select name="type">${Object.entries(L.record).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
          <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}" required></label>
          <label class="field"><span>Note (optional)</span><input type="text" name="note" maxlength="140" placeholder="e.g. new reading glasses"></label>
          ${fileField('file')}
          <button class="btn wide">Save record</button></form></details>
      ${c.records.length ? c.records.map((r, i) => `<div class="card" style="display:flex;gap:8px;align-items:flex-start">
          <div style="flex:1"><span class="tag">${esc(L.record[r.type].split(' ')[0])}</span><h3>${esc(L.record[r.type])}</h3><span class="small">${fmt(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</span>${attachment(r.file)}</div>
          <button class="iconbtn" data-del="${i}" aria-label="Delete ${esc(L.record[r.type])}">✕</button></div>`).join('')
        : '<p class="sub">No records yet. Add a letter or result.</p>'}${foot}`;
  }

  // Attachments: a photo (camera or library) or a PDF, stored on the device.
  const fileField = name => `<div class="field"><span>Photo or file (optional)</span>
      <label class="filepick"><input type="file" name="${name}" accept="image/*,application/pdf"><span class="btn sm secondary">Take a photo or choose a file</span><span class="small filename">Nothing attached</span></label>
      <p class="hint">Stays on this device.</p></div>`;
  const attachment = f => f ? `<a class="attach" data-file="${esc(f.id)}" data-type="${esc(f.type)}" href="#" target="_blank" rel="noopener">${f.type.startsWith('image/') ? '<img alt="Attached photo">' : ''}<span class="small">${esc(f.name || 'Attached file')} · open</span></a>` : '';
  async function hydrateFiles() {
    for (const a of view.querySelectorAll('a.attach[data-file]')) {
      const blob = await window.Files.get(a.dataset.file).catch(() => null);
      if (!blob) { a.outerHTML = '<span class="small">Attachment not on this device</span>'; continue; }
      const url = URL.createObjectURL(blob); a.href = url; const img = a.querySelector('img'); if (img) img.src = url;
    }
  }

  // What changed between two check-ins, in plain words.
  const DIFF = [['lastTest', 'Last sight test', L.lastTest], ['diabetes', 'Diabetes', L.diabetes], ['smoking', 'Smoking', L.smoking], ['fhGlaucomaAny', 'Glaucoma in family', L.yesNo],
    ['conditions', 'Eye conditions'], ['contacts', 'Contact lenses'], ['screens', 'Screen work'], ['drives', 'Driving'], ['bp', 'High blood pressure'], ['nation', 'Nation', L.nation], ['postcode', 'Postcode']];
  function changes(a, b) {
    const show = (k, v, map) => Array.isArray(v) ? (v.map(c => L.conditions[c]).join(', ') || 'none') : map ? map[v] || '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : v || '—';
    return DIFF.filter(([k]) => JSON.stringify(a[k] ?? '') !== JSON.stringify(b[k] ?? '')).map(([k, t, map]) => `${t}: ${show(k, b[k], map)} → ${show(k, a[k], map)}`);
  }

  function profileTab(p) {
    const yes = v => v ? 'Yes' : 'No';
    const rows = [
      ['Name', p.name || '—'], ['Nation', L.nation[p.nation]], ['Age', p.age], ['Ethnic background', L.ethnicity[p.ethnicity] || '—'],
      ['Diabetes', L.diabetes[p.diabetes]], ['Eye conditions', (p.conditions || []).map(c => L.conditions[c]).join(', ') || 'None'],
      ['Short-sighted', yes(p.myopia)], ['High blood pressure', yes(p.bp)], ['Sight impaired (registered)', yes(p.sightImpaired)], ['Benefits / HC2 / HC3', yes(p.benefits)],
      ['Glaucoma in family', L.yesNo[p.fhGlaucomaAny] + ((p.fhGlaucomaRel || []).length ? ` (${p.fhGlaucomaRel.map(r => L.rel[r].toLowerCase()).join(', ')})` : '')], ['AMD in family', yes(p.fhAMD)], ['Diabetes in family', yes(p.fhDiabetes)],
      ['Smoking', L.smoking[p.smoking]], ['Drives', yes(p.drives)], ['Contact lenses', yes(p.contacts)], ['Screen work', yes(p.screens)],
      ['Last sight test', L.lastTest[p.lastTest]], ['Your note', p.notes || '—'],
    ];
    const others = Object.entries(state.people).filter(([id]) => id !== state.current);
    return `${back('#home', 'Home')}
      <div class="profilehead"><span class="avatar lg">${esc(initial(p))}</span><div><h1>${esc(p.name || 'Your profile')}</h1><p class="sub" style="margin:0">Last check-in ${fmt(p.completedAt)} · ${esc(L.nation[p.nation])}</p></div></div>
      <h2 style="margin-top:0">At a glance</h2>
      <div class="glance">${glance(p).map(([k, v, cls]) => `<div class="card ${cls || ''}"><span class="small">${k}</span><strong>${esc(v)}</strong></div>`).join('')}</div>
      <details class="card"><summary><strong>All your answers</strong> <span class="small">· tap to view</span></summary>
        <table class="kv" style="margin-top:8px">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table></details>
      <a class="btn wide" href="#edit">New check-in</a>
      <p class="small" style="margin-top:6px">Starts from your last answers. Check in whenever something changes: a new test, a diagnosis, a new prescription.</p>
      <h2>Check-in history</h2>
      <div class="card"><ul class="tl">${cur().checkins.map((ci, i) => { const prev = cur().checkins[i + 1]; const ch = prev ? changes(ci.profile, prev.profile) : [];
        return `<li><span class="small">${fmt(ci.date)}</span><strong>${prev ? (ch.length ? `${ch.length} change${ch.length > 1 ? 's' : ''}` : 'No changes') : 'First check-in'}</strong>${ch.length ? `<ul class="plain small" style="margin-top:4px">${ch.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</li>`; }).join('')}</ul></div>
      <h2>People on this device</h2>
      ${others.map(([id, x]) => `<a class="linkrow internal" href="#switch/${id}"><span><span class="avatar sm">${esc(initial(x.profile))}</span> Switch to ${esc(x.profile.name || 'unnamed profile')}</span></a>`).join('')}
      <a class="linkrow internal" href="#new"><span>Add another person<span class="small">Each person gets their own answers, plan and records</span></span></a>
      <h2>About this app</h2>
      <a class="linkrow internal" href="#rules"><span>How we decide<span class="small">Every rule and its NHS, NICE or GOV.UK source</span></span></a>
      <a class="linkrow internal" href="#settings"><span>Display and voice<span class="small">Text size, contrast, voice, reading aloud</span></span></a>
      <a class="linkrow internal" href="#install"><span>Add to your home screen<span class="small">Open it like an app</span></span></a>
      <div class="navrow"><button class="btn danger wide" id="reset">Delete ${esc(p.name || 'this profile')}’s data</button></div>${foot}`;
  }

  function glance(p) {
    const c = M.sightTestCost(p);
    const q = M.withRx(p);
    const st = M.actions(p)[0].status;
    return [
      ['Age', p.age], ['Lives in', L.nation[p.nation]],
      ['Last sight test', L.lastTest[q.lastTest], st === 'Overdue' ? 'warn' : ''], ['Prescription', p.rx ? rxDesc(p.rx) : 'Not added'],
      ['Free NHS sight test', c.status === 'free' ? 'Likely' : c.status === 'maybe' ? 'Maybe' : 'Check with optician', c.status === 'free' ? 'green' : ''],
      ['Diabetes', L.diabetes[p.diabetes]], ['Glaucoma in family', L.yesNo[p.fhGlaucomaAny]],
      ['Suggestions arranged', `${Object.keys(cur().arranged).length} of ${M.actions(p).length}`], ['Check-ins', `${cur().checkins.length} since ${fmt(cur().checkins[cur().checkins.length - 1].date)}`],
    ];
  }

  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  function installPage() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `${back('#profile', 'Profile')}<h1>Add to your home screen</h1><p class="sub">Open the hub like an app, full screen, with its own icon.</p>
      ${standalone ? '<div class="card green"><h3>Already installed</h3><p class="sub" style="margin:0">You’re using the home screen version.</p></div>' : ''}
      ${installEvt ? '<button class="btn wide" id="installBtn" style="margin:12px 0">Install app</button>' : ''}
      <div class="card"><h3>iPhone or iPad (Safari)</h3><ol class="steps"><li>Tap the Share button at the bottom of Safari</li><li>Scroll down and tap “Add to Home Screen”</li><li>Tap “Add”</li></ol></div>
      <div class="card"><h3>Android (Chrome)</h3><ol class="steps"><li>Tap the ⋮ menu at the top right</li><li>Tap “Add to Home screen” or “Install app”</li><li>Tap “Add” or “Install”</li></ol></div>
      <p class="small">Your data stays in this browser on this device. The home screen version shares it on Android, but on iPhone it starts empty.</p>${foot}`;
  }

  function rulesPage() {
    return `${back('#home', 'Home')}<h1>How we decide</h1>
      <p class="sub">No AI decides what you see. Fixed rules run on your answers on this device, and each rule comes from a public NHS, NICE or GOV.UK source. The Assistant only matches keywords and never gives medical advice.</p>
      <div class="cards" style="margin-top:12px">${M.RULEBOOK.map(([r, w, s]) => `<div class="card"><h3>${esc(r)}</h3><p class="small">Applies when: ${esc(w)}</p>${sources(s)}</div>`).join('')}</div>${foot}`;
  }
  // ---------- display and voice settings ----------
  function applySettings() {
    const d = document.documentElement.dataset;
    d.text = SET.text; d.contrast = SET.contrast ? 'on' : 'off'; d.motion = SET.motion ? 'on' : 'off'; d.voice = SET.voice ? 'on' : 'off';
    V.configure({ enabled: SET.voice, rate: SET.rate, voiceName: SET.voiceName });
  }
  const SIZES = [['standard', 'Standard'], ['large', 'Large'], ['xlarge', 'Extra large']];
  const SPEEDS = [[0.8, 'Slow'], [0.9, 'Relaxed'], [1, 'Normal'], [1.15, 'Faster']];
  const sw = (k, label) => `<button type="button" class="switch" role="switch" aria-checked="${!!SET[k]}" data-toggle="${k}" aria-label="${label}"><span></span></button>`;
  const sizeButtons = () => `<div class="sizes" role="radiogroup" aria-label="Text size">${SIZES.map(([v, t]) => `<button type="button" role="radio" aria-checked="${SET.text === v}" data-set="text" data-val="${v}"><span class="aa aa-${v}">Aa</span>${t}</button>`).join('')}</div>`;
  function voiceOptions() {
    const vs = V.voices(), chosen = vs.find(v => v.name === SET.voiceName) || vs[0];
    return `<label class="field"><span>Which voice</span>${vs.length ? `<select id="voicePick">${vs.map(v => `<option value="${esc(v.name)}" ${v === chosen ? 'selected' : ''}>${esc(v.name.replace(/^(Microsoft|Google)\s+/, ''))} (${esc(v.lang)})</option>`).join('')}</select>` : '<p class="small">Your device’s standard voice.</p>'}</label>
      <div class="field"><span>Speed</span><div class="speeds" role="radiogroup" aria-label="Speaking speed">${SPEEDS.map(([v, t]) => `<button type="button" role="radio" aria-checked="${SET.rate === v}" data-set="rate" data-val="${v}">${t}</button>`).join('')}</div></div>
      <button type="button" class="btn secondary wide" id="previewVoice">${ICON.speaker} Hear a preview</button>`;
  }
  function settingsPage() {
    return `${back(viewP() ? '#profile' : '#', viewP() ? 'Profile' : 'Back')}<h1>Display and voice</h1><p class="sub">Make the app easier to see and hear. Changes apply straight away.</p>
      <h2>Text size</h2>${sizeButtons()}
      <div class="card switchrow"><div><h3>High contrast</h3><p class="small">Black text on white with stronger outlines</p></div>${sw('contrast', 'High contrast')}</div>
      <div class="card switchrow"><div><h3>Reduce motion</h3><p class="small">Turn off animations</p></div>${sw('motion', 'Reduce motion')}</div>
      <h2>Voice</h2>
      <div class="card switchrow"><div><h3>Voice</h3><p class="small">Hear questions and screens, and answer by speaking</p></div>${sw('voice', 'Voice')}</div>
      <div id="voiceOpts" ${SET.voice ? '' : 'hidden'}>
        <div class="card switchrow"><div><h3>Read each screen aloud</h3><p class="small">Starts when a screen opens. Tap Stop at any time</p></div>${sw('autoRead', 'Read each screen aloud')}</div>
        <div class="card">${voiceOptions()}</div>
      </div>
      <p class="small">Using VoiceOver or TalkBack already? You may prefer to leave this voice off so two voices don’t talk at once.</p>${foot}`;
  }
  const PREVIEW = 'Hello. This is how I’ll read to you. You can stop me at any time.';
  function onSetting(btn) {
    if (btn.dataset.toggle) { const k = btn.dataset.toggle; SET[k] = !SET[k]; btn.setAttribute('aria-checked', SET[k]);
      if (k === 'voice') { const o = $('#voiceOpts'); if (o) o.hidden = !SET.voice; if (!SET.voice) { V.stop(); V.stopListening(); } } }
    if (btn.dataset.set) { SET[btn.dataset.set] = btn.dataset.set === 'rate' ? +btn.dataset.val : btn.dataset.val;
      btn.parentElement.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', b === btn)); }
    save(); applySettings();
    const name = btn.getAttribute('aria-label') || btn.textContent.trim();
    if (SET.voice) V.say(btn.dataset.set === 'rate' ? PREVIEW : btn.dataset.toggle ? `${name}: ${SET[btn.dataset.toggle] ? 'on' : 'off'}.` : `Text size: ${name.replace(/^Aa/, '')}.`);
  }
  function wireSettings(root = view) {
    root.querySelectorAll('[data-toggle], [data-set]').forEach(b => b.onclick = () => onSetting(b));
    const pick = root.querySelector('#voicePick'); if (pick) pick.onchange = () => { SET.voiceName = pick.value; save(); applySettings(); V.say(PREVIEW); };
    const pv = root.querySelector('#previewVoice'); if (pv) pv.onclick = () => V.isSpeaking() ? V.stop() : V.say(PREVIEW);
  }
  // Voices load late in some browsers: refresh the picker when they arrive.
  if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {
    const f = view.querySelector('#voiceOpts .card'); if (f && location.hash === '#settings') { f.innerHTML = voiceOptions(); wireSettings(f); } });

  // First open: ask about voice (large, simple, one question at a time), then text size.
  function firstRun() {
    if (SET.chosen || NOSETUP) return;
    const box = document.createElement('div'); box.id = 'firstrun'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'frTitle');
    const step1 = () => { box.innerHTML = `<div class="frfull">
        <h2 id="frTitle">Would you like the app to read things aloud?</h2>
        <button type="button" class="frbig yes" id="frYes">YES</button>
        <button type="button" class="frbig no" id="frNo">NO</button></div>`;
      $('#frYes').onclick = () => { SET.voice = true; SET.autoRead = true; save(); applySettings(); step2(); V.say('Voice is on. Now choose a comfortable text size: standard, large, or extra large. Then tap Done. You can tap Stop at any time.'); };
      $('#frNo').onclick = () => { SET.voice = false; save(); applySettings(); step2(); };
      $('#frYes').focus(); };
    const step2 = () => { box.innerHTML = `<div class="frfull">
        <h2 id="frTitle">Choose your text size</h2>${sizeButtons()}
        <div class="card switchrow"><div><h3>High contrast</h3></div>${sw('contrast', 'High contrast')}</div>
        <button type="button" class="frbig yes" id="frDone">DONE</button></div>`;
      wireSettings(box);
      $('#frDone').onclick = () => { SET.chosen = true; save(); box.remove(); V.stop(); if (SET.voice && SET.autoRead) readPage(); view.focus(); };
      box.querySelector('[aria-checked=true]').focus(); };
    document.body.appendChild(box); step1();
  }

  // Shown whenever the app is speaking (Stop), or waiting for a first tap to start reading.
  const bar = document.getElementById('speakbar');
  function speakBar(mode) {
    if (!bar) return;
    bar.hidden = !mode; document.body.classList.toggle('barred', !!mode);   // make room so the bar never covers the page
    bar.querySelector('span').textContent = mode === 'tap' ? 'Tap anywhere to start reading aloud' : guide ? 'Voice guide on' : 'Reading aloud';
    bar.querySelector('button').textContent = mode === 'tap' ? 'Start' : 'Stop';
  }
  bar && (bar.querySelector('button').onclick = e => { e.stopPropagation(); if (pendingRead) startPending(); else stopAllVoice(); });
  V.onChange && V.onChange(on => {
    if (!pendingRead) speakBar(on || guide ? 'speaking' : false);
    document.querySelectorAll('.listenpage span').forEach(el => { el.lastChild.textContent = on ? 'Stop' : 'Listen'; });
    if (!guide && !V.canListen) setStepBtn(on);
    document.querySelectorAll('.listenpage').forEach(b => b.setAttribute('aria-pressed', on));
  });

  const notFound = () => `<h1>Page not found</h1><a class="btn" href="#home">Go home</a>`;

  // ---------- router ----------
  function route() {
    const [r, arg] = location.hash.slice(1).split('/');
    const p = viewP();
    if (r === 'settings') { show(() => { view.innerHTML = settingsPage(); }, !!p); tabs.querySelectorAll('a').forEach(a => a.removeAttribute('aria-current')); wireSettings(); addListen(); if (SET.voice && SET.autoRead && SET.chosen) readSoon(readPage); return; }
    if (r === 'urgent') { show(() => { view.innerHTML = urgentPage(p); }, !!p); tabs.querySelectorAll('a').forEach(a => a.removeAttribute('aria-current'));
      view.querySelectorAll('[data-nation]').forEach(b => b.onclick = () => { state.urgentNation = b.dataset.nation; save(); route(); });
      addListen(); if (SET.voice && SET.autoRead && SET.chosen) readSoon(readPage); return; }
    if (r === 'amsler' && p && arg === 'test') { const eye = location.hash.split('/')[2]; show(() => { view.innerHTML = amslerTest(eye); }, false); askBtn.hidden = true; wireAmsler(eye); return; }
    if (r === 'step') return show(() => renderStep(Math.min(Math.max(+arg || 1, 1), STEPS.length) - 1), false);
    if (r === 'edit') { const { rx, ...answers } = p; state.draft = answers; state.editing = true; save(); location.hash = '#step/1'; return; }
    if (r === 'new') { state.draft = {}; state.editing = false; state.current = null; save(); location.hash = '#step/1'; return; }
    if (r === 'switch') { if (state.people[arg]) state.current = arg; save(); location.hash = '#home'; return; }
    const screens = {
      foryou: ['foryou', () => forYou(p)], action: ['foryou', () => actionDetail(p, arg)],
      learn: ['learn', () => learnTab(p)], topic: ['learn', () => topicDetail(p, arg)],
      nearby: ['nearby', () => nearby(p)], records: ['records', () => records(p, arg)],
      profile: [null, () => profileTab(p)], rules: [null, () => rulesPage()], install: [null, () => installPage()],
      amsler: ['home', () => { if (arg === 'result') saveAmsler(); return arg === 'result' ? amslerResult() : amslerIntro(p); }],
    };
    const [tab, render] = !p ? [null, () => welcome()] : screens[r] || ['home', () => home(p)];
    show(() => { view.innerHTML = render(); }, !!p);
    tabs.querySelectorAll('a').forEach(a => a.hash === '#' + tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    wire(arg); if (r === 'amsler') wireAmsler();
    if (p) fillNear(p);
    addListen();
    if (SET.voice && SET.autoRead && SET.chosen) readSoon(readPage);
  }
  function addListen() {
    const h1 = view.querySelector('h1'); if (!h1 || !V.canSpeak || view.querySelector('.listenpage')) return;
    const after = h1.nextElementSibling && h1.nextElementSibling.matches('p.sub, .because') ? h1.nextElementSibling : h1;
    after.insertAdjacentHTML('afterend', `<button type="button" class="chipbtn listenpage" aria-pressed="false">${ICON.speaker} <span>Listen</span></button>`);
    view.querySelector('.listenpage').onclick = () => V.isSpeaking() ? V.stop() : readPage();
  }
  function wire(arg) {
    const t = $('#toggleArranged');
    if (t) t.onclick = () => {
      const a = M.actions(viewP()).find(x => x.id === arg);
      if (cur().arranged[arg]) { delete cur().arranged[arg]; log(`Marked "${a.title}" as not arranged`); }
      else { cur().arranged[arg] = today(); log(`Marked "${a.title}" as arranged`); }
      save(); route();
    };
    const fr = $('#addRx');
    if (fr) fr.onsubmit = async e => {
      e.preventDefault();
      const rx = readRx(Object.fromEntries(new FormData(fr)));
      if (!rx || rx.error) { $('#rxErr').textContent = rx ? rx.error : 'Add at least one sphere number.'; return; }
      rx.date ||= today();
      if (lastScan && lastScan.form === fr) { rx.file = await window.Files.save(lastScan.file).catch(() => null); lastScan = null; }
      const c = cur(); c.prescriptions.push(rx); c.prescriptions.sort((a, b) => b.date.localeCompare(a.date));
      log(`Added a prescription from ${fmt(rx.date)}`); save(); route();
    };
    view.querySelectorAll('[data-delrx]').forEach(b => b.onclick = () => { cur().prescriptions.splice(+b.dataset.delrx, 1); log('Removed a prescription'); save(); route(); });
    const f = $('#addRecord');
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const el = f.elements, r = { type: el.type.value, date: el.date.value || today(), note: el.note.value.trim() };
      const file = el.file.files[0];
      if (file) { f.querySelector('button.btn.wide').textContent = 'Saving…'; r.file = await window.Files.save(file).catch(() => null); }
      cur().records.unshift(r); cur().records.sort((a, b) => b.date.localeCompare(a.date));
      log(`Added ${L.record[r.type].toLowerCase()}${r.file ? ' with an attachment' : ''}`); save(); route();
    };
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const [r] = cur().records.splice(+b.dataset.del, 1); window.Files.remove(r.file && r.file.id);
      log(`Removed ${L.record[r.type].toLowerCase()}`); save(); route();
    });
    view.querySelectorAll('.filepick input:not([data-scan])').forEach(i => i.onchange = () => { i.parentElement.querySelector('.filename').textContent = i.files[0] ? i.files[0].name : 'Nothing attached'; });
    hydrateFiles();
    const ib = $('#installBtn');
    if (ib) ib.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; route(); };
    const rs = $('#reset');
    if (rs) rs.onclick = () => {
      if (rs.dataset.armed) {
        delete state.people[state.current]; state.current = Object.keys(state.people)[0] || null;
        save(); location.hash = state.current ? '#home' : ''; route(); return;
      }
      rs.dataset.armed = 1; rs.textContent = 'Tap again to delete for good';
    };
  }
  function show(fn, withTabs) {
    guide = null; V.stopListening(); V.stop(); pendingRead = null; speakBar(false); askBtn.hidden = !document.getElementById('chat').hidden; fn(); tabs.hidden = !withTabs; askBtn.classList.toggle('noTabs', !withTabs); document.body.classList.toggle('inapp', withTabs);
    view.scrollTop = 0; window.scrollTo(0, 0); view.focus({ preventScroll: true });
  }
  view.addEventListener('change', e => { if (e.target.matches('[data-scan]')) onScan(e.target); });
  view.addEventListener('click', e => {
    const tr = e.target.closest('tr.row'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href;
  });
  if (!NHS_LOGO) document.querySelector('.navbrand .nhs').outerHTML = logo();
  applySettings();
  addEventListener('hashchange', route);
  setTimeout(firstRun, document.getElementById('splash') && !matchMedia('(prefers-reduced-motion: reduce)').matches && !SET.motion ? 2300 : 0);
  route();

  // ---------- assistant ----------
  const chat = $('#chat'), logEl = $('#log'), input = $('#chatIn');
  function add(who, r) {
    const el = document.createElement('div');
    el.className = 'msg ' + (who === 'me' ? 'me' : 'bot ' + (r.tone || ''));
    el.innerHTML = esc(r.text) + (r.src ? sources(r.src) : '') +
      (r.go ? `<br><button class="btn go" data-go="${r.go[0]}">${esc(r.go[1])}</button>` : '') +
      (r.chips ? `<div class="chips">${r.chips.map(c => `<button type="button">${esc(c)}</button>`).join('')}</div>` : '');
    logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight;
  }
  function ask(text, byVoice) { add('me', { text }); const r = A.reply(text, viewP()); add('bot', r); if (byVoice) V.say(r.text); }
  function toggle(open) {
    chat.hidden = !open; askBtn.hidden = open; askBtn.setAttribute('aria-expanded', open);
    if (open) { if (!logEl.children.length) add('bot', A.intro()); input.focus(); } else askBtn.focus();
  }
  askBtn.onclick = () => toggle(true);
  $('#chatClose').onclick = () => toggle(false);
  if (V.canListen) {
    const m = document.createElement('button'); m.type = 'button'; m.className = 'iconbtn mic'; m.setAttribute('aria-label', 'Ask by voice'); m.innerHTML = ICON.mic;
    $('#chatForm').insertBefore(m, input.nextSibling);
    m.dataset.q = ''; m.onclick = () => {
      if (m.getAttribute('aria-pressed') === 'true') { micState(m, false); input.placeholder = 'Finishing…'; V.stopListening(); return; }
      const listening = V.listen({ onReady: () => { input.placeholder = 'Listening… tap the mic again when done'; }, onInterim: w => { input.value = w; } });
      micState(m, true); input.placeholder = 'Getting the microphone ready…';
      listening.then(([t]) => { input.value = ''; ask(t, true); }, err => { input.value = ''; const msg = V.explain(err.code); if (msg) { add('bot', { text: msg, tone: 'guard' }); V.say(msg); } })
        .finally(() => { micState(m, false); input.placeholder = 'Ask about the app or a topic'; });
    };
  }
  $('#chatForm').onsubmit = e => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; ask(t); } };
  logEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) { location.hash = b.dataset.go; toggle(false); } else ask(b.textContent);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (guide || (V.isSpeaking && V.isSpeaking())) stopAllVoice(); else if (!chat.hidden) toggle(false); } });
  if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
