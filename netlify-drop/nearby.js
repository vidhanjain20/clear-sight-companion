// Postcode → location (postcodes.io), then nearby opticians from a bundled OpenStreetMap snapshot.
// Only the postcode leaves the device.
(function () {
  const NATION = { England: 'england', Scotland: 'scotland', Wales: 'wales', 'Northern Ireland': 'ni' };

  async function lookupPostcode(pc) {
    const r = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc.trim()));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('lookup failed');
    const { result: x } = await r.json();
    return { postcode: x.postcode, lat: x.latitude, lon: x.longitude, area: x.admin_district || x.parliamentary_constituency || '', nation: NATION[x.country] || '' };
  }

  const miles = (a, b) => {
    const R = 3958.8, rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // All UK opticians from OpenStreetMap, snapshotted into opticians-uk.json (about 130 KB gzipped).
  // Loaded once and searched on the device: instant, works offline, no slow live servers.
  // ponytail: static snapshot, re-run the Overpass export to refresh it.
  let data;
  const load = () => data || (data = fetch('opticians-uk.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { data = null; throw e; }));

  async function opticians(geo) {
    const { places } = await load();
    return places.map(([name, lat, lon, address, website, phone]) => ({ name, address, website, phone, dist: miles(geo, { lat, lon }),
      map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (address || `${lat},${lon}`))}` }))
      .sort((a, b) => a.dist - b.dist).slice(0, 8);
  }

  window.Near = { lookupPostcode, opticians, miles, preload: () => load().catch(() => {}) };
})();
