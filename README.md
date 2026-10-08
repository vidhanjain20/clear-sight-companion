<p align="center">
  <img src="app/icon-192.png" width="96" alt="Clear Sight Companion logo">
</p>

<h1 align="center">Clear Sight Companion</h1>

<p align="center">
  A friendly eye health check-in for people in the UK.<br>
  Answer a few questions, find out which NHS eye checks apply to you, and keep your eye records in one place.
</p>

<p align="center">
  <a href="https://clear-sight-companion.vercel.app"><b>Try the app</b></a> ·
  <a href="demo/clear-sight-walkthrough.mp4"><b>Watch the walkthrough</b></a>
</p>

> **Concept prototype.** This is not an NHS service and does not give medical advice. It points you to official NHS, NICE and GOV.UK guidance.

---

## What it does

- **Check in in about a minute.** Answer questions about your age, where you live, your health and your family history. You can read the questions, listen to them or answer by voice.
- **See what applies to you.** Clear Sight shows the free eye tests, screening and vouchers you may be eligible for. Every suggestion links to the NHS or NICE page it comes from.
- **Keep your records.** Add your glasses prescriptions (or scan a photo of one), plus letters and results. They stay on your device.
- **Find help nearby.** Enter a postcode to see opticians near you and links to the right NHS service for your nation.
- **Weekly Amsler grid check.** A one-minute look at your central vision, one eye at a time.
- **Ask the assistant.** Ask where to find something. If you describe something urgent, it points you to urgent help straight away.

## Built for everyone

- Larger text, high contrast and reduced motion settings
- Read aloud and voice answers using the browser's built-in speech
- Works offline and installs on your phone like an app
- Several people can share one device, each with their own profile

## Privacy

Everything you enter stays on your device. There is no account and no server. The only thing that leaves your phone is a postcode, when you look up nearby opticians ([postcodes.io](https://postcodes.io)).

## Run it yourself

It's plain HTML, CSS and JavaScript, so there's nothing to install or build.

```bash
cd app
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## What's inside

| File | What it does |
| --- | --- |
| `app/index.html` | The page and all styles |
| `app/app.js` | Screens, navigation and saved data |
| `app/rules.js` | Eligibility rules, each linked to its NHS or NICE source |
| `app/chat.js` | The keyword-based assistant (no AI) |
| `app/voice.js` | Read aloud and voice answers |
| `app/rxscan.js` | Reads a prescription from a photo |
| `app/nearby.js` | Postcode lookup and nearby opticians |
| `app/files.js` | Saves photos and PDFs on the device |
| `app/sw.js` | Offline support |
