// Eye Health MOT: sources + rules. Pure data/functions, shared by the app and test.js.
// Every claim below was checked against the linked page on 2026-09-26.
// Wording is signposting only ("NHS guidance says", "you may be eligible") – never advice.

const SOURCES = {
  nhsFreeTest:   { org: 'NHS', title: 'Free NHS eye tests and optical vouchers', url: 'https://www.nhs.uk/nhs-services/opticians/free-nhs-eye-tests-and-optical-vouchers/' },
  nhsOptician:   { org: 'NHS', title: 'Visiting an optician', url: 'https://www.nhs.uk/nhs-services/opticians/visiting-an-optician/' },
  nhsGlaucoma:   { org: 'NHS', title: 'Glaucoma', url: 'https://www.nhs.uk/conditions/glaucoma/' },
  niceNG81:      { org: 'NICE', title: 'NG81 Glaucoma: diagnosis and management (2017)', url: 'https://www.nice.org.uk/guidance/ng81' },
  nhsDES:        { org: 'NHS', title: 'Diabetic eye screening', url: 'https://www.nhs.uk/conditions/diabetic-eye-screening/' },
  nhsRetinopathy:{ org: 'NHS', title: 'Diabetic retinopathy', url: 'https://www.nhs.uk/conditions/diabetic-retinopathy/' },
  nhsDiabetes:   { org: 'NHS', title: 'Diabetes', url: 'https://www.nhs.uk/conditions/diabetes/' },
  nhsHealthCheck:{ org: 'NHS', title: 'NHS Health Check', url: 'https://www.nhs.uk/conditions/nhs-health-check/' },
  nhsAMD:        { org: 'NHS', title: 'Age-related macular degeneration (AMD)', url: 'https://www.nhs.uk/conditions/age-related-macular-degeneration-amd/' },
  nhsAMDSymptoms:{ org: 'NHS', title: 'AMD: symptoms', url: 'https://www.nhs.uk/conditions/age-related-macular-degeneration-amd/symptoms/' },
  niceNG82:      { org: 'NICE', title: 'NG82 Age-related macular degeneration (2018)', url: 'https://www.nice.org.uk/guidance/ng82' },
  nhsCataracts:  { org: 'NHS', title: 'Cataracts', url: 'https://www.nhs.uk/conditions/cataracts/' },
  cuhAMD:        { org: 'Cambridge University Hospitals NHS FT', title: 'Dry AMD: using an Amsler grid', url: 'https://www.cuh.nhs.uk/patient-information/dry-age-related-macular-degeneration/' },
  macSocAMD:     { org: 'Macular Society', title: 'Macular degeneration: wet and dry AMD, the Amsler grid', url: 'https://www.macularsociety.org/macular-disease/macular-conditions/macular-degeneration/' },
  macSocHelp:    { org: 'Macular Society', title: 'Helpline: 0300 3030 111', url: 'https://www.macularsociety.org/support/one-to-one/helpline/' },
  rnibHelp:      { org: 'RNIB', title: 'Helpline: 0303 123 9999', url: 'https://www.rnib.org.uk/living-with-sight-loss/community-connection-and-wellbeing/rnib-helpline/' },
  nhsEyeInjury:  { org: 'NHS', title: 'Eye injuries', url: 'https://www.nhs.uk/conditions/eye-injuries/' },
  nhsWhenAE:     { org: 'NHS', title: 'When to go to A&E', url: 'https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-go-to-ae/' },
  niUrgent:      { org: 'nidirect', title: 'Urgent and emergency care services (Phone First)', url: 'https://www.nidirect.gov.uk/articles/urgent-and-emergency-care-services' },
  nhsRetina:     { org: 'NHS', title: 'Detached retina (retinal detachment)', url: 'https://www.nhs.uk/conditions/detached-retina-retinal-detachment/' },
  nhsMyopia:     { org: 'NHS', title: 'Short-sightedness (myopia)', url: 'https://www.nhs.uk/conditions/short-sightedness/' },
  nhsVisionLoss: { org: 'NHS', title: 'Vision loss', url: 'https://www.nhs.uk/conditions/vision-loss/' },
  nhsFloaters:   { org: 'NHS', title: 'Floaters and flashes in the eyes', url: 'https://www.nhs.uk/conditions/floaters-and-flashes-in-the-eyes/' },
  nhsRedEye:     { org: 'NHS', title: 'Red eye', url: 'https://www.nhs.uk/conditions/red-eye/' },
  nhsQuit:       { org: 'NHS', title: 'Quit smoking', url: 'https://www.nhs.uk/live-well/quit-smoking/' },
  nhsSun:        { org: 'NHS', title: 'Sunscreen and sun safety', url: 'https://www.nhs.uk/live-well/seasonal-health/sunscreen-and-sun-safety/' },
  nhsCosts:      { org: 'NHS', title: 'Help with health costs', url: 'https://www.nhs.uk/nhs-services/help-with-health-costs/' },
  moorfields:    { org: 'Moorfields Eye Hospital NHS FT', title: 'Your eye health', url: 'https://www.moorfields.nhs.uk/for-patients/your-eye-health' },
  moorfieldsScreens: { org: 'Moorfields Eye Hospital NHS FT', title: 'Do mobile phones damage your eyes?', url: 'https://www.moorfields.nhs.uk/about-us/news-and-blogs/blogs/the-potential-impact-of-your-mobile' },
  cooContacts:   { org: 'College of Optometrists', title: 'Contact lenses (Look After Your Eyes)', url: 'https://lookafteryoureyes.org/eye-wear/contact-lenses/' },
  cooScreens:    { org: 'College of Optometrists', title: 'Screen use and your eyes (Look After Your Eyes)', url: 'https://lookafteryoureyes.org/eye-care/screen-use/' },
  hseDSE:        { org: 'HSE', title: 'Display screen equipment: eye tests', url: 'https://www.hse.gov.uk/msd/dse/eye-tests.htm' },
  dvla:          { org: 'GOV.UK / DVLA', title: 'Driving eyesight rules', url: 'https://www.gov.uk/driving-eyesight-rules' },
  scotEyecare:   { org: 'NHS inform', title: 'Eyecare in Scotland', url: 'https://www.nhsinform.scot/tests-and-treatments/eyecare/' },
  scotDES:       { org: 'NHS inform', title: 'Diabetic eye screening (DES) in Scotland', url: 'https://www.nhsinform.scot/healthy-living/screening/diabetic-eye-screening-des/' },
  walesEyecare:  { org: 'NHS Wales', title: 'Eye care Wales: members of the public', url: 'https://www.nhs.wales/sa/eye-care-wales/wgos/member-of-the-public/' },
  walesDES:      { org: 'Public Health Wales', title: 'Diabetic Eye Screening Wales', url: 'https://phw.nhs.wales/services-and-teams/screening/diabetic-eye-screening-wales/' },
  niEyecare:     { org: 'nidirect', title: 'Eye care', url: 'https://www.nidirect.gov.uk/articles/eye-care' },
  niOver60:      { org: 'nidirect', title: 'Health costs and free sight tests for over 60s', url: 'https://www.nidirect.gov.uk/articles/health-costs-and-free-sight-tests-over-60s' },
  niDES:         { org: 'nidirect', title: 'NI Diabetic Eye Screening Programme', url: 'https://www.nidirect.gov.uk/contacts/ni-diabetic-eye-screening-programme' },
};

const NATIONS = {
  england: {
    name: 'England', costSource: 'nhsFreeTest', desSource: 'nhsDES',
    services: [
      { label: 'Find an optician', url: 'https://www.nhs.uk/service-search/find-an-optician', note: 'NHS.UK service search' },
      { label: 'Find a GP', url: 'https://www.nhs.uk/service-search/find-a-gp', note: 'NHS.UK service search' },
      { label: 'Find a pharmacy', url: 'https://www.nhs.uk/service-search/pharmacy/find-a-pharmacy', note: 'NHS.UK service search' },
      { label: 'NHS 111 online', url: 'https://111.nhs.uk/', note: 'Urgent, not an emergency. Or call 111' },
    ],
    urgent: 'Call 111 or use 111.nhs.uk, or get an urgent optician appointment.',
    ae: { label: 'Find your nearest A&E', url: 'https://www.nhs.uk/service-search/find-an-accident-and-emergency-service' },
    urgentActs: [{ label: 'Call 111', href: 'tel:111' }, { label: 'NHS 111 online', href: 'https://111.nhs.uk/' }],
  },
  scotland: {
    name: 'Scotland', costSource: 'scotEyecare', desSource: 'scotDES',
    services: [
      { label: 'Find an optician', url: 'https://www.nhsinform.scot/scotlands-service-directory/opticians', note: 'NHS inform service directory' },
      { label: 'Find a GP practice', url: 'https://www.nhsinform.scot/scotlands-service-directory/gp-practices', note: 'NHS inform service directory' },
      { label: 'Find a pharmacy', url: 'https://www.nhsinform.scot/scotlands-service-directory/pharmacies', note: 'NHS inform service directory' },
      { label: 'NHS inform', url: 'https://www.nhsinform.scot/', note: 'Urgent, not an emergency: call NHS 24 on 111' },
    ],
    urgent: 'Contact an optician, or call NHS 24 on 111.',
    ae: { label: 'Find A&E and minor injuries units', url: 'https://www.nhsinform.scot/scotlands-service-directory/aes-and-minor-injuries-units' },
    urgentActs: [{ label: 'Call NHS 24 on 111', href: 'tel:111' }, { label: 'NHS inform', href: 'https://www.nhsinform.scot/' }],
  },
  wales: {
    name: 'Wales', costSource: 'walesEyecare', desSource: 'walesDES',
    services: [
      { label: 'Find local services', url: 'https://111.wales.nhs.uk/localservices/', note: 'NHS 111 Wales: opticians, GPs, pharmacies' },
      { label: 'Eye care Wales', url: 'https://www.nhs.wales/sa/eye-care-wales/wgos/member-of-the-public/', note: 'NHS Wales eye care services' },
      { label: 'NHS 111 Wales', url: 'https://111.wales.nhs.uk/', note: 'Urgent, not an emergency. Or call 111' },
    ],
    urgent: 'Contact an optician, or call NHS 111 Wales.',
    ae: { label: 'Find local services, including A&E', url: 'https://111.wales.nhs.uk/localservices/' },
    urgentActs: [{ label: 'Call 111', href: 'tel:111' }, { label: 'NHS 111 Wales online', href: 'https://111.wales.nhs.uk/' }],
  },
  ni: {
    name: 'Northern Ireland', costSource: 'niEyecare', desSource: 'niDES',
    services: [
      { label: 'Eye care in NI', url: 'https://www.nidirect.gov.uk/articles/eye-care', note: 'nidirect: sight tests and opticians' },
      { label: 'GP out-of-hours', url: 'https://www.nidirect.gov.uk/articles/gp-out-hours-service', note: 'nidirect: when your GP is closed' },
    ],
    // Northern Ireland has no NHS 111: nidirect directs urgent, not life-threatening problems to Phone First.
    urgent: 'Contact your GP or an optician. When your GP is closed, use GP out-of-hours. For urgent care that isn’t life-threatening, use Phone First.',
    ae: { label: 'Hospitals and emergency departments', url: 'https://www.nidirect.gov.uk/information-and-services/health-services/hospitals-accidents-and-emergencies' },
    urgentActs: [{ label: 'Phone First and urgent care', href: 'https://www.nidirect.gov.uk/articles/urgent-and-emergency-care-services' }, { label: 'GP out-of-hours', href: 'https://www.nidirect.gov.uk/articles/gp-out-hours-service' }],
  },
};

// Urgent symptoms. Wording and routes follow the NHS pages cited.
const SYMPTOMS = [
  { id: 'suddenLoss', label: 'Sudden loss of vision in one or both eyes', level: 'emergency', src: ['nhsVisionLoss'] },
  { id: 'severePain', label: 'Sudden, severe eye pain', level: 'emergency', src: ['nhsVisionLoss', 'nhsGlaucoma'] },
  { id: 'floaters', label: 'New floaters or flashes, or a sudden increase in them', level: 'urgent', src: ['nhsFloaters'] },
  { id: 'curtain', label: 'A dark shadow or "curtain" moving across your vision', level: 'urgent', src: ['nhsFloaters', 'nhsVisionLoss'] },
  { id: 'redPainful', label: 'A red, painful eye', level: 'urgent', src: ['nhsVisionLoss', 'nhsRedEye'] },
  { id: 'blurDouble', label: 'Sudden blurred or double vision', level: 'urgent', src: ['nhsVisionLoss'] },
];

const isDiabetic = p => p.diabetes === 'type1' || p.diabetes === 'type2';
const hasCond = (p, c) => (p.conditions || []).includes(c);
const higherGlaucomaRiskBackground = p => p.ethnicity === 'blackAfricanCaribbean' || p.ethnicity === 'asian';

// Free sight test: returns { status: 'free'|'maybe'|'check', reasons[] , src }
// Prescription (latest one saved) → facts the rules use. rx = { date, re: { sph, cyl, axis, add }, le: {...} }.
// NHS: short- and long-sightedness are glaucoma risk factors; short-sightedness is a detached retina risk factor;
// lenses of -10/+10 dioptres or more qualify for a complex lens voucher (and so a free sight test in England).
const TEST_RANK = ['lt1', '1to2', 'gt2', 'never'];
function withRx(p, now = Date.now()) {
  const rx = p.rx; if (!rx || p._rx) return p;
  const sph = [rx.re, rx.le].map(e => e && parseFloat(e.sph)).filter(n => Number.isFinite(n));
  const out = { ...p, _rx: true };
  if (sph.some(n => n < 0)) out.myopia = out.rxMyopia = true;
  if (sph.some(n => n > 0)) out.hyperopia = true;
  if (sph.some(n => Math.abs(n) >= 10)) out.complexLens = true;
  if (rx.date) {
    const months = (now - new Date(rx.date)) / 2.63e9;
    const fromRx = months < 12 ? 'lt1' : months < 24 ? '1to2' : 'gt2';
    if (TEST_RANK.indexOf(fromRx) < TEST_RANK.indexOf(p.lastTest || 'never')) out.lastTest = fromRx;
  }
  return out;
}

function sightTestCost(p) {
  p = withRx(p);
  const n = p.nation || 'england';
  if (n === 'scotland') return { status: 'free', reasons: ['NHS eye examinations are free in Scotland'], src: 'scotEyecare' };
  const r = [];
  if (p.age < 16) r.push('you are under 16');
  if (p.age >= 16 && p.age <= 18 && p.fullTimeEducation) r.push('you are 16–18 and in full-time education');
  if (p.age >= 60) r.push('you are 60 or over');
  if (isDiabetic(p)) r.push('you have been diagnosed with diabetes');
  if (hasCond(p, 'glaucoma')) r.push('you have been diagnosed with glaucoma');
  if (p.age >= 40 && p.fhGlaucoma === 'close') r.push('you are 40+ and a parent, sibling or child has glaucoma');
  if (n === 'england' && p.sightImpaired) r.push('you are registered as partially sighted or blind');
  if (n === 'england' && p.complexLens) r.push('your prescription is 10 dioptres or more, so you may qualify for a complex lens voucher');
  if (r.length) return { status: 'free', reasons: r, src: NATIONS[n].costSource };
  if (p.benefits) return { status: 'maybe', reasons: ['some benefits and NHS certificates (HC2/HC3) cover sight tests'], src: n === 'england' ? 'nhsFreeTest' : NATIONS[n].costSource };
  return { status: 'check', reasons: [], src: NATIONS[n].costSource };
}

function sightTestStatus(last) {
  return { lt1: 'Up to date', '1to2': 'Due soon', gt2: 'Overdue', never: 'Overdue' }[last] || 'Unknown';
}

// Urgent: emergency beats urgent. Returns null or { level, items, src[] }.
function urgent(p) {
  const hit = SYMPTOMS.filter(s => (p.symptoms || []).includes(s.id));
  if (!hit.length) return null;
  const level = hit.some(s => s.level === 'emergency') ? 'emergency' : 'urgent';
  return { level, items: hit.map(s => s.label), src: [...new Set(hit.flatMap(s => s.src))] };
}

// Actions for the Plan tab. Each: id, title, why[], freq, cost, status, src[], learn[]
function actions(p) {
  p = withRx(p);
  const out = [];
  const cost = sightTestCost(p);
  const why = ['NHS guidance: have your eyes tested every 2 years, or more often if your optometrist advises.'];
  if (p.fhGlaucoma === 'close') why.push('Glaucoma in a parent, brother or sister is a known risk factor (NHS).');
  if (higherGlaucomaRiskBackground(p)) why.push('The NHS lists a Black African, Caribbean or Asian background as a glaucoma risk factor.');
  if (p.age >= 50) why.push('The NHS lists being over 50 as a glaucoma risk factor.');
  if (p.rxMyopia) why.push('Your prescription shows short-sightedness, which the NHS lists as a risk factor for glaucoma and a detached retina.');
  else if (p.myopia) why.push('The NHS lists short-sightedness as a risk factor for glaucoma and a detached retina.');
  if (p.hyperopia) why.push('Your prescription shows long-sightedness, which the NHS lists as a glaucoma risk factor.');
  if (isDiabetic(p)) why.push('Diabetic eye screening does not replace a regular eye test (NHS).');
  const mention = [];
  if (p.rx && p.rx.date) mention.push(`Your latest prescription (${new Date(p.rx.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})`);
  if (p.fhGlaucoma === 'close' || p.fhGlaucoma === 'other') mention.push('Family history of glaucoma' + (p.fhGlaucomaWho ? ` (${p.fhGlaucomaWho})` : ''));
  if (p.fhAMD) mention.push('Family history of AMD');
  if (p.contacts) mention.push('You wear contact lenses');
  if (p.notes && p.notes.trim()) mention.push(`Your note: "${p.notes.trim()}"`);
  out.push({
    id: 'sightTest', title: 'Sight test with an optician', why, mention,
    freq: 'Every 2 years, or as advised', status: sightTestStatus(p.lastTest),
    cost, src: ['nhsOptician', cost.src, ...(p.fhGlaucoma === 'close' || higherGlaucomaRiskBackground(p) ? ['nhsGlaucoma', 'niceNG81'] : [])],
    learn: ['glaucoma'],
    arrange: ['Use the official finder below to choose an optician near you.',
      cost.status === 'free' ? 'When you book, say why you may get a free NHS sight test: ' + cost.reasons.join('; ') + '. The optician will confirm.' : 'When you book, ask whether you qualify for a free NHS sight test. The optician will check.',
      'Take your current glasses or contact lenses with you.',
      'Mention the points listed under "To mention".'],
  });

  if (isDiabetic(p) && p.age >= 12) out.push({
    id: 'des', title: 'Diabetic eye screening',
    why: ['The NHS invites everyone with diabetes aged 12 or over to diabetic eye screening.', 'Screening looks for diabetic retinopathy before it affects sight.'],
    freq: 'Every 1–2 years, by invitation', status: 'By invitation',
    cost: { status: 'free', reasons: ['NHS screening programme'] },
    src: [NATIONS[p.nation || 'england'].desSource, 'nhsDES', 'nhsRetinopathy'], learn: ['retinopathy'],
    arrange: ['Screening is by invitation. Look out for a letter.', 'Not had an invitation? Your GP practice or local screening service can tell you more.', 'Screening is separate from your sight test. You need both.'],
  });

  if (p.conditions && p.conditions.length) out.push({
    id: 'followUp', title: 'Keep your eye clinic follow-up',
    why: ['You told us you have an existing eye condition. Your specialist team sets how often you are seen.'],
    freq: 'As arranged by your care team', status: 'Ongoing',
    cost: { status: 'free', reasons: ['NHS care'] }, src: ['nhsVisionLoss'], learn: p.conditions.filter(c => TOPICS[c]),
    arrange: ['Go to the appointments your eye clinic sends you.', 'Not heard from them when expected? Contact the clinic or your GP practice.'],
  });

  if (hasCond(p, 'amd')) out.push({
    id: 'amsler', title: 'Weekly Amsler grid check',
    why: ['NICE advises discussing self-monitoring with people with AMD, and reporting straight lines that look distorted, a blurred or grey patch, or objects looking smaller than normal as soon as possible.',
      'An NHS eye clinic (Cambridge University Hospitals) suggests checking with an Amsler grid once a week.'],
    freq: 'Once a week', status: 'Weekly', cost: { status: 'free', reasons: ['in this app'] },
    src: ['niceNG82', 'cuhAMD', 'macSocAMD'], learn: ['amsler'],
    arrange: ['Open the Amsler grid check in this app. It takes about a minute.', 'Check one eye at a time, looking at the centre dot.', 'If something is new or worse, contact an optician or your eye clinic as soon as possible.'],
  });

  if (p.smoking === 'current') out.push({
    id: 'smoking', title: 'Free NHS stop smoking support',
    why: ['The NHS links smoking to AMD.', 'Moorfields Eye Hospital: smokers are twice as likely to lose their sight in later life.'],
    freq: 'Any time', status: 'Optional', cost: { status: 'free', reasons: ['NHS service'] },
    src: ['nhsQuit', 'nhsAMD', 'moorfields'], learn: ['amd'],
    arrange: ['See the free support options on the NHS Quit smoking page (linked in Sources).'],
  });

  if (p.screens) out.push({
    id: 'dse', title: 'Workplace eye test (screen users)',
    why: ['HSE: an employer must provide and pay for an eye test for a display screen user who asks for one.'],
    freq: 'On request', status: 'Optional', cost: { status: 'free', reasons: ['paid by your employer'] },
    src: ['hseDSE'], learn: ['screens'],
    arrange: ['Ask your employer or manager for a display screen equipment (DSE) eye test.', 'The HSE page in Sources explains what your employer must pay for.'],
  });

  if (p.contacts) out.push({
    id: 'contacts', title: 'Contact lens check-ups',
    why: ['The College of Optometrists advises regular aftercare with your contact lens practitioner.'],
    freq: 'As set by your practitioner', status: 'Ongoing', cost: { status: 'check', reasons: [] },
    src: ['cooContacts'], learn: ['contacts'],
    arrange: ['Keep to the check-up schedule your contact lens practitioner gave you.', 'Use the optician finder below if you need a new practice.'],
  });

  if (p.drives) out.push({
    id: 'driving', title: 'Know the driving eyesight rules',
    why: ['GOV.UK: you must be able to read a number plate from 20 metres, with glasses or lenses if needed.', 'You must tell DVLA about an eyesight problem that affects both eyes.'],
    freq: 'Whenever your vision changes', status: 'Info', cost: { status: 'na', reasons: [] },
    src: ['dvla'], learn: ['driving'],
    arrange: ['Read the GOV.UK driving eyesight rules (linked in Sources).', 'If you have an eye condition affecting both eyes, the same page explains how to tell DVLA.'],
  });
  return out;
}

// Learn topics. Personalised by `when(p)` which returns the "shown because" text or null.
const TOPICS = {
  urgentHelp: { title: 'When to get urgent help for your eyes', always: true,
    when: () => 'shown to everyone',
    body: ['NHS: call 999 or go to A&E for sudden complete loss of vision or sudden severe eye pain. Do not drive yourself.',
      'NHS: get urgent help for new or sudden floaters or flashes, a shadow across your vision, a red painful eye, or sudden blurred or double vision.'],
    src: ['nhsVisionLoss', 'nhsFloaters'] },
  glaucoma: { title: 'Glaucoma',
    when: p => p.fhGlaucoma === 'close' ? 'a close relative has glaucoma' : p.fhGlaucoma === 'other' ? 'a relative has glaucoma' : p.fhGlaucoma === 'unsure' ? 'you were not sure about glaucoma in your family' : higherGlaucomaRiskBackground(p) ? 'your ethnic background' : hasCond(p, 'glaucoma') ? 'you have glaucoma' : p.myopia ? 'you are short-sighted' : p.hyperopia ? 'you are long-sighted' : isDiabetic(p) ? 'you have diabetes' : p.age >= 50 ? 'you are over 50' : null,
    body: ['Glaucoma usually develops slowly and often has no symptoms at first, so it is often found at a routine eye test (NHS).',
      'NHS risk factors: over 50; a parent, brother or sister with glaucoma; a Black African, Caribbean or Asian background; short- or long-sightedness; diabetes.',
      'NICE guideline NG81 sets out how glaucoma is tested for and managed in the UK.'],
    src: ['nhsGlaucoma', 'niceNG81'] },
  retinopathy: { title: 'Diabetes and your eyes',
    when: p => isDiabetic(p) ? 'you have diabetes' : hasCond(p, 'retinopathy') ? 'you have diabetic retinopathy' : null,
    body: ['Diabetic retinopathy is more likely with long-standing diabetes, high blood pressure and high cholesterol (NHS).',
      'The NHS says going to all your screening appointments helps find problems as early as possible.'],
    src: ['nhsRetinopathy', 'nhsDES'] },
  diabetesUnsure: { title: 'Not sure if you have diabetes?',
    when: p => isDiabetic(p) ? null : p.diabetes === 'unsure' ? 'you were not sure about diabetes' : p.fhDiabetes ? 'diabetes runs in your family' : null,
    body: ['The NHS diabetes pages explain the symptoms and how diabetes is diagnosed.',
      'In England, the free NHS Health Check is offered to adults aged 40 to 74 without certain existing conditions.'],
    src: ['nhsDiabetes', 'nhsHealthCheck'] },
  amd: { title: 'Age-related macular degeneration (AMD)',
    when: p => hasCond(p, 'amd') ? 'you have AMD' : p.fhAMD ? 'AMD runs in your family' : p.smoking === 'current' ? 'you smoke' : p.age >= 50 ? 'you are over 50' : null,
    body: ['The NHS links AMD to ageing, smoking, high blood pressure, being overweight and a family history of AMD. It usually appears from the 50s.',
      'NHS: contact an optician urgently or call 111 if your vision suddenly gets worse.',
      'NICE guideline NG82 covers how AMD is diagnosed and managed.'],
    src: ['nhsAMD', 'nhsAMDSymptoms', 'niceNG82'] },
  cataract: { title: 'Cataracts',
    when: p => hasCond(p, 'cataract') ? 'you have cataracts' : p.age >= 60 ? 'you are 60 or over' : null,
    body: ['Cataracts cause cloudy or blurry vision and are common as people get older (NHS).'],
    src: ['nhsCataracts'] },
  amsler: { title: 'Checking your central vision (Amsler grid)',
    when: p => hasCond(p, 'amd') ? 'you have AMD' : p.fhAMD ? 'AMD runs in your family' : null,
    body: ['An Amsler grid is a square of straight lines with a dot in the middle. Looking at the dot with one eye at a time can show changes in your central vision, such as wavy, blurred or missing lines (Macular Society).',
      'In wet AMD, abnormal blood vessels leak into the macula and can cause rapid loss of central vision, so fast treatment matters (Macular Society).',
      'NICE advises people with AMD to report distorted straight lines, a blurred or grey patch, or objects looking smaller than normal as soon as possible.'],
    src: ['macSocAMD', 'niceNG82', 'cuhAMD'] },
  retina: { title: 'Detached retina: signs to know',
    when: p => p.myopia ? 'you are short-sighted' : null,
    body: ['The NHS lists being short-sighted as something that makes a detached retina more likely.',
      'NHS: get help from 111 straight away if floaters suddenly appear or increase, you see sudden flashes, a dark shadow moves across your vision, or your vision suddenly blurs.'],
    src: ['nhsRetina'] },
  myopia: { title: 'Short-sightedness',
    when: p => p.myopia ? 'you are short-sighted' : p.age < 16 ? 'you are under 16' : null,
    body: ['The NHS says short-sightedness often runs in families and more time outdoors may help slow it in children.',
      'Eye tests are free for children under 16, with a voucher towards glasses (NHS).'],
    src: ['nhsMyopia'] },
  screens: { title: 'Screens and eye strain',
    when: p => p.screens ? 'you do a lot of screen work' : null,
    body: ['Long screen use can cause tired, dry eyes. Regular breaks and blinking help with comfort (College of Optometrists, Moorfields).',
      'HSE: employers must provide an eye test for display screen users on request.'],
    src: ['cooScreens', 'moorfieldsScreens', 'hseDSE'] },
  contacts: { title: 'Contact lens safety',
    when: p => p.contacts ? 'you wear contact lenses' : null,
    body: ['College of Optometrists: never let lenses or their case touch tap water, and do not sleep in lenses unless your optometrist says you can.',
      'Wash and dry your hands before touching your lenses.'],
    src: ['cooContacts'] },
  driving: { title: 'Driving and eyesight',
    when: p => p.drives ? 'you drive' : null,
    body: ['GOV.UK: drivers must read a number plate from 20 metres and meet the minimum visual acuity and field of vision.',
      'You must tell DVLA about an eyesight problem affecting both eyes. Short- or long-sightedness alone does not need reporting.'],
    src: ['dvla'] },
  sun: { title: 'Sunlight and your eyes', always: true,
    when: () => 'shown to everyone',
    body: ['NHS: choose sunglasses with the CE mark and British Standard BS EN ISO 12312-1:2013 E. Reflected sun from sand, water and snow is a particular risk.'],
    src: ['nhsSun'] },
  costs: { title: 'Help with eye care costs',
    when: p => p.benefits ? 'you get benefits or hold an NHS certificate' : sightTestCost(p).status === 'check' ? 'you may have to pay for sight tests' : null,
    body: ['Some benefits and NHS certificates (HC2, HC3) cover sight tests and give vouchers towards glasses.'],
    src: ['nhsCosts', 'nhsFreeTest'] },
};
// Amsler check is due when never done, or 7+ days since the last one (weekly, per CUH NHS guidance).
function amslerDue(history = [], now = Date.now()) {
  if (!history.length) return { due: true, days: null };
  const days = Math.floor((now - Date.parse(history[0].date + 'T00:00:00Z')) / 864e5);
  return { due: days >= 7, days };
}

function learn(p) {
  p = withRx(p);
  return Object.entries(TOPICS)
    .map(([id, t]) => ({ id, ...t, because: t.when(p) }))
    .filter(t => t.because)
    .sort((a, b) => (a.always ? 1 : 0) - (b.always ? 1 : 0));
}

// Every rule, for the "How we decide" page.
const RULEBOOK = [
  ['Sight test every 2 years', 'Everyone', ['nhsOptician']],
  ['Free sight test (England)', 'Under 16; 16–18 in full-time education; 60+; diabetes or glaucoma; 40+ with a parent, sibling or child with glaucoma; registered sight impaired; certain benefits or HC2/HC3', ['nhsFreeTest']],
  ['Free eye examination (Scotland)', 'Everyone', ['scotEyecare']],
  ['Free sight test (Wales, NI)', 'Under 16; 60+; diabetes or glaucoma; 40+ with close relative with glaucoma; certain benefits. Otherwise: check with your optician', ['walesEyecare', 'niEyecare', 'niOver60']],
  ['Diabetic eye screening', 'Type 1 or type 2 diabetes, aged 12+', ['nhsDES']],
  ['Glaucoma information', 'Family history, Black African/Caribbean or Asian background, 50+, myopia, diabetes', ['nhsGlaucoma', 'niceNG81']],
  ['AMD information', 'AMD in family, smoker, 50+, existing AMD', ['nhsAMD', 'niceNG82']],
  ['From your prescription', 'Short-sighted: glaucoma and detached retina info. Long-sighted: glaucoma info. ±10 dioptres or more: complex lens voucher (free sight test in England). Prescription date updates when your last test was', ['nhsGlaucoma', 'nhsRetina', 'nhsFreeTest']],
  ['Weekly Amsler grid check', 'You have AMD (NICE NG82 1.7.4–1.7.5; weekly per Cambridge University Hospitals NHS). Available to anyone in the app', ['niceNG82', 'cuhAMD']],
  ['Stop smoking support', 'Current smoker', ['nhsQuit', 'nhsAMD']],
  ['Workplace eye test', 'Screen-heavy work', ['hseDSE']],
  ['Driving eyesight rules', 'Drives', ['dvla']],
  ['Emergency banner (999 / A&E)', 'Sudden vision loss or sudden severe eye pain', ['nhsVisionLoss']],
  ['Urgent banner', 'New floaters/flashes, shadow across vision, red painful eye, sudden blurred/double vision', ['nhsFloaters', 'nhsVisionLoss']],
];

const MOT = { SOURCES, NATIONS, SYMPTOMS, TOPICS, RULEBOOK, sightTestCost, urgent, actions, learn, withRx, amslerDue };
if (typeof module !== 'undefined') module.exports = MOT; else window.MOT = MOT;
