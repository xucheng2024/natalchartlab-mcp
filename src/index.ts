// Natal Chart Lab MCP server (stdio): current sky, planet positions, birth placements, retrogrades and Moon phases.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { birthPlacements, currentSky, moonPhases, PLANETS, positions, retrogrades } from './tools.ts';

export const VERSION = '1.0.0';

export function createServer() {
  const server = new McpServer({ name: 'natalchartlab', version: VERSION, title: 'Natal Chart Lab' });
  const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
  const wrap = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => {
    try { return { content: [{ type: 'text' as const, text: JSON.stringify(await fn(a), null, 2) }] }; }
    catch (e) { return { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] }; }
  };
  const when = z.string().optional();

  server.registerTool('get_current_sky', {
    title: 'Current sky',
    description: 'The sky right now: tropical zodiac sign and degree of the Sun, Moon and planets, the Moon\'s phase, illumination, next sign change and void-of-course windows for the next seven days, and which planets are retrograde or in shadow. Times are UTC.',
    annotations: ro,
  }, wrap(() => currentSky()));

  server.registerTool('get_planet_positions', {
    title: 'Planet positions at a time',
    description: 'Tropical zodiac positions (longitude, sign, degree, daily speed, retrograde flag) of the Sun, Moon, Mercury–Pluto, mean North Node and mean Black Moon Lilith at a UTC instant between 1800 and 2200. Apparent geocentric, checked against NASA JPL Horizons.',
    inputSchema: { time: when.describe('ISO 8601 UTC time, e.g. 2026-01-01T12:00Z. Defaults to now.') },
    annotations: ro,
  }, wrap(({ time }: { time?: string }) => positions(time)));

  server.registerTool('get_birth_placements', {
    title: 'Birth chart planet signs',
    description: 'Sun, Moon and planet signs for a local birth date and clock time. Give the UTC offset that was in force at the birth (including daylight saving). Does not compute the rising sign or houses, which need the birth place; the result links to the free full calculator.',
    inputSchema: {
      date: z.string().describe('Birth date, YYYY-MM-DD'),
      time: z.string().describe('Local clock time, HH:MM 24-hour. Use 12:00 if unknown (the Moon may then be off by a sign).'),
      utc_offset: z.string().describe('UTC offset at the birth, e.g. -05:00, +01:00, +05:30'),
    },
    annotations: ro,
  }, wrap(({ date, time, utc_offset }: { date: string; time: string; utc_offset: string }) => birthPlacements(date, time, utc_offset)));

  server.registerTool('get_retrogrades', {
    title: 'Retrograde periods',
    description: 'Retrograde periods of Mercury through Pluto overlapping a date range, with station retrograde and direct times, signs and degrees, and pre-shadow and post-shadow dates. Covers retrogrades beginning 1950–2050. Defaults to the next 12 months.',
    inputSchema: {
      planet: z.enum(PLANETS).optional().describe('Limit to one planet'),
      from: when.describe('Start date (ISO 8601). Defaults to now.'),
      to: when.describe('End date (ISO 8601). Defaults to 12 months after from.'),
    },
    annotations: ro,
  }, wrap((a: { planet?: typeof PLANETS[number]; from?: string; to?: string }) => retrogrades(a)));

  server.registerTool('get_moon_phases', {
    title: 'Moon phases',
    description: 'New Moons, first quarters, Full Moons and last quarters in a date range, with the UTC time, zodiac sign and degree, Earth–Moon distance and any eclipse. Covers 1950–2050. Defaults to the next 60 days.',
    inputSchema: {
      from: when.describe('Start date (ISO 8601). Defaults to now.'),
      to: when.describe('End date (ISO 8601). Defaults to 60 days after from.'),
      phase: z.enum(['new moon', 'first quarter', 'full moon', 'last quarter']).optional().describe('Only this phase'),
    },
    annotations: ro,
  }, wrap((a: { from?: string; to?: string; phase?: string }) => moonPhases(a)));

  return server;
}

export const runStdio = () => createServer().connect(new StdioServerTransport());
