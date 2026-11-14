import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/index.ts';
import { birthPlacements, moonPhases, retrogrades, setFetch } from '../src/tools.ts';

const RETRO = {
  columns: ['planet', 'station_retrograde_utc', 'station_direct_utc', 'retrograde_sign'],
  rows: [['mercury', '2026-02-26T06:48Z', '2026-03-20T19:33Z', 'Pisces'], ['mars', '2027-01-10T00:00Z', '2027-04-01T00:00Z', 'Virgo'], ['mercury', '2030-01-01T00:00Z', '2030-01-20T00:00Z', 'Aquarius']],
};
const CSV = 'phase,utc,moon_longitude,sign,degree_in_sign,distance_km,eclipse\nfull moon,2026-03-03T11:38Z,342.5,Pisces,12.50,384000,total lunar\nnew moon,2026-03-19T01:23Z,358.0,Pisces,28.00,370000,\n';
const seen: string[] = [];
setFetch((async (url: string) => {
  seen.push(url);
  const u = new URL(url);
  const body = u.pathname === '/data/retrogrades.json' ? RETRO
    : u.pathname === '/data/moon-phases.csv' ? CSV
    : u.pathname === '/api/positions' ? { time: new Date(u.searchParams.get('t')!).toISOString(), source: 'https://natalchartlab.com/methodology', positions: [{ name: 'Sun', sign: 'Cancer', degree: '12°10′', retrograde: false }] }
    : { time: 'now' };
  return new Response(typeof body === 'string' ? body : JSON.stringify(body));
}) as typeof fetch);

test('birth placements convert local time with the offset to UTC', async () => {
  const r = await birthPlacements('1990-07-04', '09:30', '-04:00');
  assert.equal(r.birth_utc, '1990-07-04T13:30:00.000Z');
  assert.equal(r.placements[0].sign, 'Cancer');
  assert.equal((await birthPlacements('1990-07-04', '00:15', '+05:30')).birth_utc, '1990-07-03T18:45:00.000Z');
  await assert.rejects(birthPlacements('1990-7-4', '09:30', '+00:00'), /YYYY-MM-DD/);
  await assert.rejects(birthPlacements('1990-07-04', '25:00', '+00:00'), /real calendar time/);
  await assert.rejects(birthPlacements('1990-07-04', '09:30', 'EST'), /utc_offset/);
});

test('retrogrades filter by overlap and planet', async () => {
  const r = await retrogrades({ from: '2026-03-01', to: '2027-02-01' });
  assert.deepEqual(r.retrogrades.map(x => x.planet), ['mercury', 'mars']);
  assert.equal((await retrogrades({ planet: 'mars', from: '2026-01-01', to: '2031-01-01' })).count, 1);
  await assert.rejects(retrogrades({ from: '2027-01-01', to: '2026-01-01' }), /after from/);
});

test('moon phases filter by range and phase; the table is fetched once', async () => {
  const r = await moonPhases({ from: '2026-03-01', to: '2026-03-31', phase: 'full moon' });
  assert.equal(r.count, 1);
  assert.equal(r.phases[0].eclipse, 'total lunar');
  await moonPhases({ from: '2026-03-01', to: '2026-03-31' });
  assert.equal(seen.filter(u => u.endsWith('/data/moon-phases.csv')).length, 1);
});

test('the server lists five read-only tools and returns errors as tool errors', async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(b);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['get_birth_placements', 'get_current_sky', 'get_moon_phases', 'get_planet_positions', 'get_retrogrades']);
  assert.ok(tools.every(t => t.annotations?.readOnlyHint));
  const bad = await client.callTool({ name: 'get_planet_positions', arguments: { time: 'not a time' } });
  assert.equal(bad.isError, true);
  const ok = await client.callTool({ name: 'get_retrogrades', arguments: { planet: 'mercury', from: '2026-01-01', to: '2026-12-31' } });
  assert.equal(JSON.parse((ok.content as { text: string }[])[0].text).count, 1);
  await client.close();
});
