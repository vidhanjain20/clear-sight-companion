// Voice: hear questions and pages (speechSynthesis), answer by speaking (SpeechRecognition).
// Uses the browser's built-in speech; nothing extra to download. Where recognition isn't supported
// (for example Firefox), the mic buttons simply don't appear and everything else still works.
(function (root) {
  const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const SYN = { yeah: 'yes', yep: 'yes', yup: 'yes', correct: 'yes', nope: 'no', nah: 'no', none: 'no', never: 'never', dunno: 'not sure', unsure: 'not sure',
    dad: 'parent', mum: 'parent', mom: 'parent', father: 'parent', mother: 'parent', son: 'child', daughter: 'child', brother: 'brother', sister: 'sister' };
  const STOP = new Set('i im a an the am is are have has had my me or and in of to been with for do you it its this that was were at on about just'.split(' '));

  // "fifty two" → 52, "type two" → "type 2"
  function numberWords(t) {
    return t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, a, b) => WORDS[a] + WORDS[b])
      .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, w => WORDS[w]);
  }
  const norm = t => numberWords(String(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ')).replace(/\s+/g, ' ').trim();
  const tokens = t => norm(t).split(' ').map(w => SYN[w] || w).join(' ').split(' ').filter(w => w && !STOP.has(w));

  function score(spoken, label) {
    const s = tokens(spoken), l = tokens(label);
    if (!l.length) return 0;
    let hit = l.filter(w => s.includes(w)).length;
    if (norm(spoken).includes(norm(label))) hit += 2;
    return hit / Math.sqrt(l.length);
  }

  // Pick the options a spoken answer refers to. Returns values.
  function match(spoken, options, multiple) {
    const t = norm(spoken);
    if (multiple && /^(no|none|nothing|neither|none of (these|them))\b/.test(t)) return [];
    const scored = options.map(o => ({ v: o.value, s: score(spoken, o.label) })).filter(o => o.s > 0).sort((a, b) => b.s - a.s);
    if (!scored.length) return null;
    return multiple ? scored.filter(o => o.s >= scored[0].s * 0.5).map(o => o.v) : [scored[0].v];
  }

  // Field-specific understanding for the trickier answers.
  const SPECIAL = {
    age: t => { const n = norm(t).match(/\b\d{1,3}\b/); return n ? n[0] : null; },
    postcode: t => { const c = norm(t).replace(/\b(space|and)\b/g, '').replace(/\s/g, '').toUpperCase().replace(/^([A-Z]{1,2})(ZERO|OH)/, '$10');
      return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(c) ? c.slice(0, -3) + ' ' + c.slice(-3) : null; },
    lastTest: t => { const s = norm(t);
      if (/never|cant remember|dont know|not sure/.test(s)) return 'never';
      const mo = s.match(/(\d+)\s*months?/); if (mo) return +mo[1] < 12 ? 'lt1' : +mo[1] <= 24 ? '1to2' : 'gt2';
      if (/months?|this year|last year|recent|weeks?/.test(s) && !/\d+ years?/.test(s)) return 'lt1';
      const n = s.match(/(\d+)\s*(years?|yrs?)/); if (n) return +n[1] < 1 ? 'lt1' : +n[1] <= 2 ? '1to2' : 'gt2';
      if (/a (couple|few) of years|couple years/.test(s)) return /few/.test(s) ? 'gt2' : '1to2';
      return null; },
  };

  // ---- speech out
  // Calm by default: a gentle en-GB voice, a little slower, short pauses between sentences.
  // Speech is read in short chunks (some Chrome voices cut off after ~15s), so Stop works instantly.
  const S = () => root.speechSynthesis;
  const CALM = /serena|kate|martha|stephanie|libby|sonia|hazel|google uk english female|female/i;
  function voices() {
    const all = S() ? S().getVoices().filter(v => /^en/i.test(v.lang)) : [];
    const rank = v => (/en-GB/i.test(v.lang) ? 0 : 10) + (CALM.test(v.name) ? 0 : 3) + (/natural|premium|enhanced|online/i.test(v.name) ? 0 : 1);
    return all.sort((a, b) => rank(a) - rank(b));
  }
  const cfg = { enabled: true, rate: 0.9, voiceName: '' };
  const configure = o => Object.assign(cfg, o);
  const listeners = [];
  let speaking = false, token = 0;
  const setSpeaking = v => { if (v !== speaking) { speaking = v; listeners.forEach(f => f(v)); } };

  function chunk(text, max = 220) {
    const out = [];
    for (const sentence of String(text).replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*[”"’)]*\s*/g) || []) {
      let s = sentence.trim();
      while (s.length > max) { const cut = s.lastIndexOf(' ', max); out.push(s.slice(0, cut > 0 ? cut : max)); s = s.slice(cut > 0 ? cut + 1 : max); }
      if (!s) continue;
      if (out.length && out[out.length - 1].length + s.length + 1 <= max && !/[.!?]["”’)]*$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + s; else out.push(s);
    }
    return out;
  }

  function say(text, onend) {
    stop(true);
    if (!cfg.enabled || !S() || !text) return;
    const parts = chunk(text), my = ++token;
    const v = voices().find(x => x.name === cfg.voiceName) || voices()[0];
    const next = i => {
      if (my !== token) return;
      if (i >= parts.length) { setSpeaking(false); if (onend) onend(); return; }
      const u = new root.SpeechSynthesisUtterance(parts[i]);
      if (v) u.voice = v; u.lang = (v && v.lang) || 'en-GB'; u.rate = cfg.rate; u.pitch = 1;
      u.onstart = () => my === token && setSpeaking(true);
      u.onend = () => i + 1 < parts.length ? setTimeout(() => next(i + 1), 250) : next(i + 1);   // pause between sentences only
      u.onerror = () => { if (my === token) setSpeaking(false); };
      S().speak(u);
    };
    setSpeaking(true); next(0);
  }
  function stop(quiet) { token++; if (S()) S().cancel(); if (!quiet) setSpeaking(false); else if (speaking) setSpeaking(false); }
  const isSpeaking = () => speaking;
  const onChange = f => listeners.push(f);

  // ---- speech in
  // One listening session at a time. Tapping the same mic again stops it; starting another mic aborts the first.
  // start() is called synchronously inside the tap, so browsers that need a user gesture (Safari) allow it.
  const Rec = () => root.SpeechRecognition || root.webkitSpeechRecognition;
  let active = null;
  const fail = (code) => Object.assign(new Error(code), { code });

  // Stopping must never depend on the browser. Real Chrome ignores stop() while the microphone is still starting
  // up (about 2s on first use) and then keeps listening until the speech ends. So a tap to finish settles the session
  // straight away with whatever was heard, and the recogniser is forced to shut down, now or whenever it wakes up.
  function listen(opts = {}) {
    if (active) active.cancel('aborted');
    if (root.isSecureContext === false) return Promise.reject(fail('insecure'));
    const R = Rec(); if (!R) return Promise.reject(fail('unsupported'));
    stop();
    return new Promise((ok, no) => {
      let r, settled = false, heard = null, live = '', why = null, grace = null, limit = null;
      const kill = () => { try { r.abort(); } catch { /* already gone */ } };
      const session = {
        // Finish: let the browser deliver its last words for a moment, then settle regardless.
        stop: () => { if (settled) return; why = why || 'stopped'; try { r.stop(); } catch { /* ignore */ } clearTimeout(grace); grace = setTimeout(() => { kill(); finish(); }, 700); },
        // Another mic took over: end now, and never answer with this session's words.
        cancel: c => { if (settled) return; why = c; kill(); finish(); },
      };
      const finish = () => {
        if (settled) return; settled = true; clearTimeout(grace); clearTimeout(limit);
        if (active === session) active = null;
        if (why === 'aborted') return no(fail('aborted'));
        // Use the final result; if the browser never sent one, fall back to the last words it heard live.
        heard ? ok(heard) : live ? ok([live]) : no(fail(why || 'no-speech'));
      };
      try {
        // Live (interim) results: shown on screen while speaking, and a fallback when no final result arrives.
        r = new R(); r.lang = 'en-GB'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
        r.onaudiostart = () => { if (settled || why) kill(); else if (opts.onReady) opts.onReady(); };
        r.onresult = e => {
          if (settled) return;
          const res = [...e.results], fin = res.filter(x => x.isFinal !== false);
          if (fin.length) heard = [...fin[fin.length - 1]].map(a => a.transcript.trim()).filter(Boolean);
          live = res.map(x => x[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
          if (opts.onInterim && live) opts.onInterim(live);
        };
        r.onerror = e => { if (settled) return; if (!why || why === 'stopped') why = e.error === 'aborted' && why ? why : e.error; };
        r.onend = finish;
        active = session;
        limit = setTimeout(session.stop, opts.maxMs || 20000);   // safety limit
        r.start();
      } catch (e) { active = null; settled = true; clearTimeout(limit); no(fail(/not.?allowed|permission/i.test(e.message) ? 'not-allowed' : 'unavailable')); }
    });
  }
  const stopListening = () => active && active.stop();
  const isListening = () => !!active;

  // What to show (and say) for each outcome. '' = say nothing (the person stopped it themselves).
  const isApple = /iPhone|iPad|Macintosh/.test((root.navigator || {}).userAgent || '') && !/Chrome|CriOS|Edg/.test((root.navigator || {}).userAgent || '');
  function explain(code) {
    return ({
      stopped: '', aborted: '',
      'no-speech': 'Sorry, I didn’t hear anything. Tap the microphone, then speak.',
      'not-allowed': isApple
        ? 'The microphone is blocked for this site. On iPhone: Settings → Apps → Safari → Microphone → Allow (also allow Speech Recognition). On Mac: Safari → Settings → Websites → Microphone → Allow. Then reload the page.'
        : 'The microphone is blocked for this site. Click the icon to the left of the web address, set Microphone to Allow, then reload the page.',
      'service-not-allowed': 'Voice input is switched off on this device. Turn on Siri & Dictation in Settings, then try again. If you opened the app from your home screen, try it in Safari instead.',
      'audio-capture': 'No microphone was found. Check one is connected and not in use by another app.',
      network: 'Voice input needs an internet connection. Check you’re online and try again.',
      insecure: 'Voice input only works on a secure link (starting https://). Open clear-sight-companion.vercel.app instead.',
      unsupported: 'This browser doesn’t support voice input. Try Chrome, Edge or Safari. You can still hear every question.',
      'language-not-supported': 'Voice input isn’t available in English (UK) on this browser.',
    })[code] ?? 'Voice input didn’t work that time. Please try again.';
  }

  const api = { say, stop, isSpeaking, onChange, configure, voices, chunk, cfg, listen, stopListening, isListening, explain, match, norm, SPECIAL,
    get canSpeak() { return !!S(); }, get canListen() { return !!Rec(); } };
  if (typeof module !== 'undefined') module.exports = api; else root.Voice = api;
})(typeof window !== 'undefined' ? window : globalThis);
