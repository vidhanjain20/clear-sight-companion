// Assistant: keyword rules only, no AI. It signposts and navigates; it never assesses symptoms or advises.
// Order matters: emergency > urgent > medical-advice guard > navigation > topics > fallback.
// ponytail: keyword matching, swap for an LLM behind the same guard order if judges want free-text depth.

(function () {
  const M = window.MOT;
  const EMERGENCY = /(can'?t see|cannot see|lost (my |the )?(sight|vision)|gone blind|went blind|sudden(ly)?\b.*\b(blind|loss|lost|severe)|severe\b.*\bpain|chemical|injur|hit in the eye)/i;
  const URGENT = /(flash|floater|curtain|shadow|pain|red eye|eye is red|double vision|blur)/i;
  const ADVICE = /(should i\b|do i have|have i got|is (it|this) (normal|serious|bad)|diagnos|what'?s wrong|wrong with|treat|medic|drops|dose|prescribe|cure|worried|itch|sore|dry eye)/i;
  const NAV = [
    [/amsler|grid check|central vision|macular/i, '#amsler', 'The Amsler grid check is a 1-minute look at your central vision, one eye at a time. Once a week is a good routine.', 'Open the Amsler grid check'],
    [/emergenc|urgent|a ?& ?e|999|111|helpline/i, '#urgent', 'The urgent help page says what NHS guidance advises and who to contact where you live.', 'Urgent eye help'],
    [/how (do )?(you|we) decide|rules|evidence|sources?|reliable|safe|nice\b|gmc/i, '#rules', 'Every recommendation comes from a written rule, and each rule links to its NHS, NICE or GOV.UK source.', 'Open How we decide'],
    [/services?|optician|optometrist|\bgp\b|pharmac|near me|local|book|appointment/i, '#nearby', 'The Nearby tab links to the official NHS finder for your nation. This app does not book appointments.', 'Open Nearby'],
    [/prescription|glasses|lens power|dioptre/i, '#records/rx', 'Prescriptions keeps each prescription you add. The latest one is used in your suggestions, for example being short-sighted is an NHS-listed glaucoma risk factor.', 'Open Prescriptions'],
    [/records?|timeline|history of my|documents?/i, '#records', 'Records keeps your prescriptions and letters, and a timeline of what you have done. It all stays on this device.', 'Open Records'],
    [/edit|change (my )?answers|update|profile|person|switch|family member|home screen|install/i, '#profile', 'Your profile has your answers, people on this device, and how to add the app to your home screen.', 'Open your profile'],
    [/plan|to ?do|next|actions?|for you|recommend/i, '#foryou', 'For you lists what NHS guidance suggests for someone with your answers.', 'Open For you'],
    [/learn|\bread\b|info/i, '#learn', 'Learn has topics picked for your answers, each with its sources.', 'Open Learn'],
  ];
  const TOPIC_WORDS = [
    [/glaucoma/i, 'glaucoma'], [/macular|\bamd\b/i, 'amd'], [/diabet|retinopathy|screening/i, 'retinopathy'],
    [/cataract/i, 'cataract'], [/myopia|short.?sight/i, 'myopia'], [/screen|computer|laptop|phone/i, 'screens'],
    [/contact|lens/i, 'contacts'], [/driv|dvla|number plate/i, 'driving'], [/\bsun|\buv\b|sunglass/i, 'sun'],
    [/smok|vape|cigar/i, 'amd'],
  ];

  function reply(text, p) {
    const nation = M.NATIONS[(p && p.nation) || 'england'];
    if (EMERGENCY.test(text)) return { tone: 'emergency', text: 'If you have sudden loss of vision or sudden severe eye pain, call 999 or go to A&E now. Do not drive yourself.', src: ['nhsVisionLoss'], go: ['#urgent', 'Urgent eye help'] };
    if (URGENT.test(text)) return { tone: 'urgent', text: `I can't assess symptoms. NHS guidance says some eye symptoms need help the same day. ${nation.urgent} For an emergency, call 999.`, src: ['nhsVisionLoss', 'nhsFloaters'], go: ['#urgent', 'Urgent eye help'] };
    if (ADVICE.test(text)) return { tone: 'guard', text: `I can't give medical advice or tell you what's right for you. An optician, pharmacist or GP can. ${nation.urgent}`, go: ['#nearby', 'Find a service'] };
    if (/free|cost|pay|price|voucher|charge/i.test(text)) {
      if (!p) return { text: 'Finish the questions and I can show which NHS rules on free sight tests match your answers.' };
      const c = M.sightTestCost(p);
      const t = c.status === 'free' ? `NHS rules suggest you may get a free sight test because ${c.reasons.join('; ')}. Your optician will confirm.`
        : c.status === 'maybe' ? 'You may be eligible, depending on which benefit or certificate you have. Your optician will confirm.'
        : 'None of the NHS free sight test rules matched your answers. You may have to pay. Your optician can confirm.';
      return { text: t, src: [c.src] };
    }
    for (const [re, hash, t, label] of NAV) if (re.test(text)) return { text: t, go: [hash, label] };
    for (const [re, id] of TOPIC_WORDS) if (re.test(text)) {
      const topic = M.TOPICS[id];
      return { text: topic.body[0], src: topic.src, go: ['#topic/' + id, 'Read: ' + topic.title] };
    }
    if (/^(hi|hello|hey|help|who are you|what can you do)/i.test(text.trim()) || !text.trim()) return intro();
    return { text: "I don't have an answer for that. I can help you find your way around the app and share general information from NHS and NICE pages.", chips: CHIPS };
  }

  const CHIPS = ['Am I eligible for a free sight test?', 'Find an optician', 'What is glaucoma?', 'How do you decide?'];
  const intro = () => ({ text: 'I can help you find your way around, explain what is recommended for you and point you to NHS sources. I can’t give medical advice.', chips: CHIPS });

  window.Assistant = { reply, intro };
})();
