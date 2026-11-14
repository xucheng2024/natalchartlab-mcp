// Tool logic, kept apart from the MCP wiring so it can be tested without a transport.
// Every value comes from the public, keyless Natal Chart Lab API (https://natalchartlab.com/astrology-api).

export const SITE = process.env.NATALCHARTLAB_URL?.replace(/\/$/, '') || 'https://natalchartlab.com';
const UA = 'natalchartlab-mcp/1.0.0 (+https://github.com/xucheng2024/natalchartlab-mcp)';

type Fetch = typeof fetch;
let fetcher: Fetch = (...a) => fetch(...a);
/** Swap the HTTP client (tests). */
export const setFetch = (f: Fetch) => { fetcher = f; cache.clear(); };

async function get(path: string, as: 'json' | 'text' = 'json'): Promise<any> {
  const res = await fetcher(`${SITE}${path}`, { headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : 'text/csv' } });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const b = await res.json() as { error?: string }; if (b.error) msg = b.error; } catch { /* not JSON */ }
    throw new Error(`Natal Chart Lab API: ${msg}`);
  }
  return as === 'json' ? res.json() : res.text();
}

// The retrograde and Moon phase tables are fixed (1950–2050), so they are fetched once per process.
const cache = new Map<string, Promise<any>>();
const once = (path: string, as: 'json' | 'text') => {
  if (!cache.has(path)) cache.set(path, get(path, as).catch(e => { cache.delete(path); throw e; }));
  return cache.get(path)!;
};

const DAY = 86_400_000;
const parseTime = (s: string | undefined, name: string): Date => {
  const d = s ? new Date(s) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error(`${name} must be an ISO 8601 date or time, e.g. 2026-01-01 or 2026-01-01T12:00Z`);
  return d;
};

export const currentSky = () => get('/api/sky');

export const positions = (time?: string) => get(`/api/positions?t=${encodeURIComponent(parseTime(time, 'time').toISOString())}`);

/** Local birth date and clock time plus the UTC offset in force then → planet signs. No houses or rising sign. */
export async function birthPlacements(date: string, time: string, utcOffset: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (!/^\d{1,2}:\d{2}$/.test(time)) throw new Error('time must be HH:MM (24-hour)');
  const m = /^([+-])(\d{1,2}):?(\d{2})?$/.exec(utcOffset.trim());
  if (!m) throw new Error('utc_offset must look like +08:00, -05:00 or +5:30');
  const offsetMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  const [h, mi] = time.split(':').map(Number);
  const local = Date.parse(`${date}T00:00:00Z`) + (h * 60 + mi) * 60_000;
  if (Number.isNaN(local) || h > 23 || mi > 59) throw new Error('date or time is not a real calendar time');
  const utc = new Date(local - offsetMin * 60_000).toISOString();
  const res = await get(`/api/positions?t=${encodeURIComponent(utc)}`);
  return {
    birth_utc: res.time,
    placements: res.positions.map((p: any) => ({ body: p.name, sign: p.sign, degree: p.degree, retrograde: p.retrograde })),
    note: 'Planet signs only. The rising sign and houses need the birth place; the free calculator at the link below does the full chart, including the time zone lookup.',
    full_chart: `${SITE}/`,
    source: res.source,
  };
}

const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
export type Planet = typeof PLANETS[number];
export { PLANETS };

export async function retrogrades(opts: { planet?: Planet; from?: string; to?: string }) {
  const from = parseTime(opts.from, 'from');
  const to = opts.to ? parseTime(opts.to, 'to') : new Date(from.getTime() + 365 * DAY);
  if (to < from) throw new Error('to must be after from');
  const t = await once('/data/retrogrades.json', 'json') as { columns: string[]; rows: (string | number)[][] };
  const rows = t.rows
    .map(r => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])))
    .filter(r => (!opts.planet || r.planet === opts.planet)
      // overlap: the period (station retrograde → station direct) touches [from, to]
      && new Date(String(r.station_direct_utc)) >= from && new Date(String(r.station_retrograde_utc)) <= to);
  return {
    from: from.toISOString(), to: to.toISOString(), count: rows.length, retrogrades: rows.slice(0, 100),
    ...(rows.length > 100 ? { truncated: true } : {}),
    coverage: 'Retrogrades beginning 1950–2050. Times are UTC.', license: 'CC BY 4.0, credit Natal Chart Lab',
    source: `${SITE}/retrogrades`,
  };
}

export async function moonPhases(opts: { from?: string; to?: string; phase?: string }) {
  const from = parseTime(opts.from, 'from');
  const to = opts.to ? parseTime(opts.to, 'to') : new Date(from.getTime() + 60 * DAY);
  if (to < from) throw new Error('to must be after from');
  const csv = await once('/data/moon-phases.csv', 'text') as string;
  const [head, ...lines] = csv.trim().split('\n');
  const cols = head.split(',');
  const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])))
    .filter(r => { const d = new Date(r.utc); return d >= from && d <= to && (!opts.phase || r.phase === opts.phase); })
    .map(r => ({ phase: r.phase, utc: r.utc, sign: r.sign, degree_in_sign: Number(r.degree_in_sign), distance_km: Number(r.distance_km), ...(r.eclipse ? { eclipse: r.eclipse } : {}) }));
  return {
    from: from.toISOString(), to: to.toISOString(), count: rows.length, phases: rows.slice(0, 200),
    ...(rows.length > 200 ? { truncated: true } : {}),
    coverage: 'New Moons, quarters and Full Moons 1950–2050. Times are UTC.', source: `${SITE}/moon-phases`,
  };
}
