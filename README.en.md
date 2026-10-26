<img src="public/favicon.svg" width="56" alt="" align="left" />

# ChroniQ · 星曆

[中文](README.md) · [English](README.en.md)

A calendar, a view of the real sky, and several charting traditions in one web app. No account is required. Calculations run locally in your browser, and the app can be installed for offline use.

**[Open the app →](https://redcarpg.github.io/ChroniQ/)** · [English Spec](docs/SPEC.en.md) · [中文 Spec](docs/SPEC.zh-CN.md)

## Features

| Page | Capabilities |
| --- | --- |
| Calendar | Month, week and year views; Chinese lunar dates, solar terms, moon phases, stems and branches, almanac entries, Chinese/French holidays and dates associated with saved charts |
| Sky | Sky at a chosen time and location; Western constellations, Chinese asterisms and the 28 mansions; daily tracks, rise/set times and historical tracks |
| Moon | Lunar globe, phase, libration and local moonrise/moonset |
| Solar system | Planetary orbits and positions, distances, light travel times, direct/retrograde motion and time playback |
| Bazi | Four pillars, ten gods, symbolic stars and fortune periods; optional apparent solar time and school-specific rules |
| Ziwei Doushu | Twelve palaces, stars, four transformations and multiple fortune layers, with configurable schools |
| Western astrology | Natal charts, transits, progressions, synastry and composite charts, with configurable house systems and other methods |

Save charts, share links, export images or print. Choose Chinese or English interface text, traditional or simplified Chinese terminology, light/dark themes, interface scale and sound settings.

<table>
  <tr>
    <td width="50%"><img src="docs/images/calendar.jpg" alt="Calendar page" /><br /><b>Calendar</b></td>
    <td width="50%"><img src="docs/images/sky.jpg" alt="Sky page" /><br /><b>Sky</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/bazi.jpg" alt="Bazi page" /><br /><b>Bazi</b></td>
    <td><img src="docs/images/ziwei.jpg" alt="Ziwei Doushu page" /><br /><b>Ziwei Doushu</b></td>
  </tr>
  <tr>
    <td><img src="docs/images/star.jpg" alt="Western astrology page" /><br /><b>Western astrology</b></td>
    <td>Screenshots illustrate the main pages. Consult the current app and Spec for current behavior.</td>
  </tr>
</table>

## Local development

Use Node.js 22 (matching CI) and npm. From the repository root:

```bash
npm ci
npm run dev
```

```bash
npm test           # Vitest tests
npm run typecheck  # TypeScript checks
npm run build      # Type-check and generate dist/
npm run preview    # Preview the production build
```

The app uses React 19, TypeScript and Vite. There is no backend or database, and no API keys are required. The development server does not register a Service Worker; validate offline behavior and updates with a production build. `legacy/` contains the previous implementation for reference.

## Privacy and offline use

Birth information, charts and preferences are stored in the current browser's local storage. There are no accounts or cloud synchronization. A shared link's `#` fragment contains birth information and an optional location, which recipients can read; the link is not encrypted storage.

The production Service Worker caches app resources for offline use after the initial online load and successful caching. Some font subsets and the high-resolution lunar texture are cached on demand; unavailable resources use fallback fonts or a lower-resolution texture. Updates activate after all pages controlled by the old version are closed.

## Documentation

- **Spec: [English](docs/SPEC.en.md) / [中文](docs/SPEC.zh-CN.md)** — product scope, data contracts, technical constraints and acceptance criteria.
- [Feature guide](docs/features.md) (Chinese) — how each page works.
- [Schools and methods](docs/schools.md) (Chinese) — alternative rules, implementations and sources.
- [Development guide](docs/development.md) (Chinese) — structure, translations, generators and offline development.

GitHub Actions tests, builds and deploys pushes to `main` to GitHub Pages. Pull requests run tests and builds without deployment.

## Credits

Calendar and Bazi: [tyme4ts](https://github.com/6tail/tyme4ts) · Ziwei Doushu: [iztro](https://github.com/SylarLong/iztro) · Astronomy: [astronomy-engine](https://github.com/cosinekitty/astronomy) · Star catalogue: [d3-celestial](https://github.com/ofrohn/d3-celestial)

Fonts: [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) / [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) (SIL Open Font License). See the [asset notes](src/assets/moon/README.md) for lunar texture sources.

> Divination-related content is provided for cultural reference only.
