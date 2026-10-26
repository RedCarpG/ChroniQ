# ChroniQ Product and Technical Specification

[English](SPEC.en.md) · [中文](SPEC.zh-CN.md) · [Back to README](../README.en.md)

This document describes the current implementation and its acceptance requirements for development, testing and maintenance. It is not a roadmap of unimplemented features. Changes to behavior should update both language versions, the relevant source and tests. See the [feature guide](features.md) and [schools reference](schools.md) for usage and alternative traditions; those guides are in Chinese.

## 1. Product scope

ChroniQ is a static web app for mobile and desktop browsers, combining calendar information, astronomical visualization and several charting traditions. It opens on the calendar by default and includes seven pages: Calendar, Sky, Moon, Solar System, Bazi, Ziwei Doushu and Western Astrology.

- No registration, application backend, database or external calculation API is required.
- Birth information, charts and preferences are used locally in the browser; there is no cloud synchronization.
- The app can run online or be installed as a PWA. Offline availability depends on successful resource caching.
- Divination-related content is for cultural reference, with no claim of scientifically valid predictions.

## 2. Functional specification

| ID | Module | Current scope |
| --- | --- | --- |
| F-01 | Calendar | Month, week and year views; Gregorian/lunar dates, solar terms, moon phases, stems and branches, almanac details; Chinese/French holiday selection; configurable week start and display options |
| F-02 | Chart dates | Select one saved chart to show birthdays, pillar relationships, fortune transitions and annual Tai Sui information; optional solar returns and exact aspects of slow planets to the natal Sun, Moon and Ascendant |
| F-03 | Sky | Bodies at a chosen time and coordinates; azimuth, altitude, magnitude and rise/set times; Western constellations, Chinese asterisms and 28 mansions; overhead/below-ground views, zoom, pan, time dragging and selection |
| F-04 | Tracks | Daily tracks span 12 hours before and after the displayed instant, with dashed past segments, solid future segments and local whole-hour marks; historical tracks cover approximately 1, 3 or 12 months |
| F-05 | Moon | Lunar globe, phase, libration and moonrise/moonset for the selected location |
| F-06 | Solar system | Planetary orbits and positions, distances, light travel times, direct/retrograde motion and time playback; the page loads independently of the Sky interface |
| F-07 | Bazi | Four pillars, ten gods, symbolic stars, five elements, fortune onset and nested fortune periods; configurable apparent solar time, late-Zi-hour handling and other school rules |
| F-08 | Ziwei Doushu | Twelve palaces, stars, four transformations, palace-stem transformations, multiple fortune layers and school settings |
| F-09 | Western astrology | Natal charts, transits, progressions, synastry and composite charts; selectable house systems, nodes and related progression methods |
| F-10 | Chart management | Local save, load and delete; saving under an existing name updates that chart; birth-data share links, PNG export and printing |
| F-11 | Interface | Chinese/English text, traditional/simplified Chinese terminology, light/dark themes, interface scale, sound and responsive layouts |

## 3. Input and time contracts

### Birth input

The sources of truth are [BaziInput](../src/lib/bazi.ts), [input validation](../src/lib/savedCharts.ts) and [place validation](../src/lib/place.ts).

| Field | Meaning and constraints |
| --- | --- |
| `year`, `month`, `day` | Gregorian birth date; years 1900–2100, with a real calendar date |
| `hour`, `minute` | Wall-clock time at the birthplace; hours 0–23 and minutes 0–59; incomplete edits must not be submitted to chart calculations |
| `gender` | Parameter used by the current chart libraries: `1` for male, `0` for female |
| `place` | Optional name, latitude −90…90, longitude −180…180 and valid IANA time zone; Beijing is the default |
| `trueSolar` | Optional apparent solar time for Bazi and Ziwei; Western charts use the corresponding UTC instant |

- Changing the year or month clamps the date control to the valid number of days in that month.
- Stored data and shared links are validated before entering chart rendering.
- Nonexistent birth times during daylight-saving gaps are rejected with an explanation. Repeated times during backward transitions use the earlier occurrence and display a notice.
- The underlying [time-zone conversion](../src/lib/timeZone.ts) uses forward adjustment for gaps and reports `gap`, `overlap` or `exact`; birth-input entry points separately reject `gap` results.
- Apparent solar time uses longitude, the historical local time-zone offset and an approximation of the equation of time. Alternative traditions belong in existing school settings rather than implicit component-specific rules.
- Exact transit aspects are bracketed with daily samples, refined to an instant, then assigned to a calendar date in the birthplace's time zone, including local-year boundaries.

## 4. Local data and sharing

- Charts, the last birth input, the synastry partner and preferences use `localStorage`. Selection, menus, zoom and similar interaction state follow individual page lifecycles; reopening does not guarantee restoration of every interaction state.
- When storage is unavailable, usable session state remains. Corrupt entries are validated and either replaced by valid defaults or ignored.
- There is no server backup or cross-device synchronization. Deleted browser site data cannot be restored from a server.
- Sharing uses the URL `#` fragment, defined in [shareLink.ts](../src/lib/shareLink.ts):

| Parameter | Content |
| --- | --- |
| `t` | `bazi`, `ziwei` or `star` |
| `d` | `YYYY-MM-DDTHH:mm`, in birthplace local time |
| `g` | `m` or `f` |
| `pn`, `lat`, `lon`, `tz` | Optional place name, coordinates and time zone; shared coordinates are rounded to two decimal places |
| `ts` | `1` enables apparent solar time |
| `lng` | Longitude parameter supported for legacy links |

The fragment is not sent to the site server in an ordinary HTTP page request, but recipients can read its data. Links do not carry the saved-chart collection, school options or interface preferences; the recipient calculates with their own settings. The fragment is parsed once and removed from the address bar. Invalid core fields, such as the date, prevent loading that shared chart; invalid places may fall back to the default location.

## 5. Visual and interaction specification

- The calendar detail card emphasizes the date, lunar date and pillars. It uses Noto Serif SC throughout; supporting descriptions and almanac lists use weight 400, 13px and reduced contrast. Both themes must remain readable.
- Mansion cells in the Sky table use weight 400 and subdued colors representing the four celestial regions, without competing with body information through bold weight or bright color.
- A selected body's track remains highlighted while another body is hovered. Hover may show that body's track without replacing the selection.
- Selected daily and historical tracks gently vary in opacity from 0.8 to 1 over 3.2 seconds. Hover-only tracks do not pulse. Smooth quality mode, time dragging and `prefers-reduced-motion: reduce` disable this effect.
- Layouts adapt to narrow screens. Core controls support keyboard operation and accessible names. Browser geolocation is explicitly requested by the user and subject to browser permission.
- English translates interface text. Stems/branches, symbolic stars, Ziwei star names and similar Chinese terms remain Chinese and follow the script setting. Some terminology explanations remain in Chinese.

## 6. Technical structure

| Layer | Entry points and responsibilities |
| --- | --- |
| App shell | [App.tsx](../src/App.tsx): page switching, shared birth input and settings |
| Pages/components | [components/](../src/components/): calendar, charting, astronomy and shared interaction components |
| Calculation | [lib/](../src/lib/): calendars, charts, time zones, places, astronomical models and validation |
| Background computation | [chartWestern.worker.ts](../src/lib/chartWestern.worker.ts) and [westernClient.ts](../src/lib/westernClient.ts): yearly transit requests, cancellation, results and errors |
| Sky rendering | [skyGeometry.ts](../src/components/skyGeometry.ts), [skyScene.ts](../src/components/skyScene.ts), [useSkyBackdrop.ts](../src/components/useSkyBackdrop.ts) and [skyPaint.ts](../src/components/skyPaint.ts): geometry, scene data, independent layer caching and canvas painting |
| Translation | [i18n/](../src/i18n/): Chinese source keys, English dictionaries, placeholders and coverage checks |
| PWA | [scripts/pwa.ts](../scripts/pwa.ts) and [sw-template.js](../scripts/sw-template.js): production asset manifest and Service Worker |

The runtime stack is React 19, TypeScript and Vite. Calendar/Bazi calculations use tyme4ts, Ziwei uses iztro and astronomy uses astronomy-engine. `legacy/` is outside the current app build path.

## 7. Performance and offline constraints

- Calendar is the default entry page; other interfaces, including Bazi, load on demand. The Solar System page must not load the whole Sky interface merely to reuse a color table.
- Yearly transit calculations run in a Worker. Leaving the calendar or changing relevant conditions cancels obsolete tasks. Failures offer retry, and cancellation is not reported as a calculation failure.
- Caches have limits: 24 yearly transit results in the client, 48 calendar-year results and 16 Bazi charts. These capacities are not page-wide performance deadlines.
- Faint stars, star clouds and the deep stellar field cache their coordinates independently. Changing one layer's detail condition should not rotate unaffected layers again.
- The production Service Worker precaches final build files. HTML and script content changes affect the version; intermediate files removed by Vite must not appear in the manifest.
- A new worker waits for old controlled pages to close before activating. Pages use HTML paired with the active worker, preventing mixed-version module loading.
- Font subsets and resources such as the high-resolution lunar texture are cached on demand and may degrade gracefully offline. A first visit without prior caching is not guaranteed to work offline.
- The development server does not register a Service Worker. Starting it successfully is not an offline acceptance check.

## 8. Acceptance criteria

IDs match the Chinese version. These define regression checks, not a claim that every scenario is fully automated.

| ID | Scenario and expected result |
| --- | --- |
| A-01 | After `npm ci`, tests and the production build succeed, with passing type checks; PRs run the same core checks |
| A-02 | `2026-02-31`, a non-leap February 29 and an empty birth-time control cannot crash chart rendering; valid leap days and midnight are accepted |
| A-03 | New York `2024-03-10 02:30` cannot be submitted as a birth time; `2024-11-03 01:30` uses the earlier instant with a notice |
| A-04 | Valid share links open the appropriate chart page; invalid dates and corrupt partner storage do not cause rendering exceptions |
| A-05 | Transit dates use the birthplace's time zone, with cross-day test coverage; background tasks support cancellation, retry and bounded cache reuse |
| A-06 | The calendar's eager dependency graph excludes the Bazi interface; the Solar System static graph excludes `SkyView`; all precache paths exist in final output or public assets |
| A-07 | Old pages can still load old modules while an update waits; closing old pages permits activation and old-cache cleanup without deleting unrelated application caches |
| A-08 | After initial caching, the production app can reload offline and run cached core functionality; optional resources degrade as specified |
| A-09 | Text hierarchy remains clear in both themes and narrow layouts; mansion cells retain regular weight; track pulses apply only to selection and respect reduced motion |
| A-10 | Sky zoom, dragging, quality, hemisphere, figure switching and selection retain their behavior; unrelated layers do not repeat coordinate rotations when detail thresholds change |

Automated checks use Vitest, with happy-dom for component tests. They do not replace real layout, canvas, font or Service Worker verification; changes to those paths need real-browser checks. See the [development guide](development.md) for commands, translation and generation scripts.

## 9. Build and release

Node.js 22 is recommended to match [CI](../.github/workflows/pages.yml). Run `npm ci`, `npm test` and `npm run build`; `npm run typecheck` is available separately. Use `npm run preview` to preview `dist/`.

`dist/` is deployable as a static site, and Vite uses relative asset paths. GitHub Actions tests and builds pull requests, with an additional GitHub Pages deployment on `main`. A successful local build is not publication.
