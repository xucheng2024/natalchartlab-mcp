# Natal Chart Lab MCP server

An [MCP](https://modelcontextprotocol.io) server that gives AI assistants accurate astrology and sky data: where the Sun, Moon and planets are on the tropical zodiac, the signs in a birth chart, retrograde periods with shadow dates, and Moon phases.

It is a thin client for the free, keyless [Natal Chart Lab astrology API](https://natalchartlab.com/astrology-api). Positions come from Astronomy Engine and are [checked against NASA JPL Horizons](https://natalchartlab.com/methodology) (largest difference at 50 test points is 19.5 arcseconds, well under a hundredth of a degree). No API key, no sign-up, no personal data stored.

## Tools

| Tool | What it returns |
| --- | --- |
| `get_current_sky` | Sun, Moon and planet signs and degrees now; the Moon's phase, illumination, next sign change and void-of-course windows for seven days; which planets are retrograde or in shadow |
| `get_planet_positions` | Longitude, sign, degree, daily speed and retrograde flag for every body at any UTC time, 1800–2200 |
| `get_birth_placements` | Sun, Moon and planet signs for a local birth date, clock time and UTC offset (no rising sign or houses; see the [birth chart calculator](https://natalchartlab.com/) for those) |
| `get_retrogrades` | Retrogrades of Mercury–Pluto in a date range with station times, signs, degrees and pre/post-shadow dates (1950–2050) |
| `get_moon_phases` | New Moons, quarters and Full Moons in a date range with sign, degree, distance and eclipses (1950–2050) |

Example questions it answers: *"Is Mercury retrograde right now, and when is the next one?"*, *"What sign is the Moon in, and is it void of course?"*, *"I was born 4 July 1990 at 9:30 in New York. What are my Sun, Moon and Venus signs?"*, *"List the full moons in 2027 and their signs."*

## Install

Requires Node.js 18 or later.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "natalchartlab": {
      "command": "npx",
      "args": ["-y", "natalchartlab-mcp"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add natalchartlab -- npx -y natalchartlab-mcp
```

### Cursor, Windsurf, VS Code and others

Use the same command, `npx -y natalchartlab-mcp`, as a stdio server.

## Data and accuracy

- Tropical zodiac; apparent geocentric positions on the true ecliptic of date.
- Mean North Node and mean Black Moon Lilith.
- Retrograde and Moon phase tables are CC BY 4.0 and also published as datasets ([retrogrades](https://doi.org/10.5281/zenodo.23837493), [Moon phases](https://doi.org/10.5281/zenodo.23837461)).
- Full method: [natalchartlab.com/methodology](https://natalchartlab.com/methodology).

Set `NATALCHARTLAB_URL` to point the server at another deployment of the same API.

## Development

```sh
npm install
npm test
npm run build
```

## Licence

MIT. Data from [Natal Chart Lab](https://natalchartlab.com).
