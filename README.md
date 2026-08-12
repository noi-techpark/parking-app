<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: CC0-1.0
-->

# Parking App

[![REUSE Compliance](https://github.com/noi-techpark/parking-app/actions/workflows/reuse.yml/badge.svg)](https://github.com/noi-techpark/odh-docs/wiki/REUSE#badges)

A map dashboard of real-time parking availability, published to the Open Data
Hub webcomponent store as `<bolzano-parking-app>` and deployed as a standalone
site to [parking.opendatahub.com](https://parking.opendatahub.com).

Data comes from the Open Data Hub [mobility](https://mobility.api.opendatahub.com)
and [tourism](https://tourism.api.opendatahub.com) APIs.

## Getting started

```bash
yarn install
yarn dev          # http://localhost:5173
yarn build        # -> dist/bolzano-parking-app.min.js + dist/index.html
yarn test         # unit + component tests
yarn lint
```

Node 20.19+ or 22.12+ is required (Vite 7). `docker-compose up` runs the dev
server in a container if you would rather not install Node locally.

### Build output

One artefact serves both consumers:

- `dist/bolzano-parking-app.min.js` — the self-contained IIFE bundle listed in
  `wcs-manifest.json` and pushed to the webcomponent store.
- `dist/index.html` — a thin shell that loads that same bundle. This *is* the
  standalone site synced to S3.

### Environments

The API host is fixed at build time, never at runtime, so a published component
cannot be pointed at the test API by an attribute:

```bash
yarn build                  # production APIs, webcomponent
ENVIRONMENT=test yarn build # *.testingmachine.eu
MATOMO=true yarn build      # adds Matomo + cookie consent to dist/index.html
STANDALONE=true yarn build  # the site build: enables URL state mirroring
```

The CI sets `MATOMO` and `STANDALONE` on the two site deployments and leaves
them off for the webcomponent pushes.

## Embedding

```html
<script src="bolzano-parking-app.min.js"></script>
<bolzano-parking-app></bolzano-parking-app>
```

The element renders into a shadow root, so host page styles do not leak in.
`demo/index.html` embeds it five ways on a deliberately hostile page; open it
after `yarn build`.

### Attributes

Custom-element attributes are always strings, including booleans — write
`show-static="false"`, not `:show-static="false"`.

| Attribute | Default | Purpose |
|---|---|---|
| `municipalities` | `""` | Comma-separated municipality names to preselect |
| `parkings` | `""` | Comma-separated station codes. When set, **only these are shown** — a fixed dashboard |
| `origins` | `""` | Restrict to given data origins |
| `status` | `""` | Preselect `live`, `delayed`, `static` |
| `filters` | all | Which filters the visitor may change; `none` locks the view |
| `search` | `""` | Preset the free-text search |
| `live-max-age` | `30m` | How recent a reading must be to count as real time |
| `stale-max-age` | `6mo` | Readings older than this are not shown at all |
| `refresh-interval` | `60s` | Poll interval for readings |
| `show-static` | `true` | Include parkings with no live availability |
| `language` | `en` | Interface language |
| `center` / `zoom` | `""` | Override the initial camera (`"lon,lat"`) |

Durations accept `s`, `m`, `h`, `d`, `w`, `mo`, `y`.

### Custom dashboards

Setting `parkings` restricts the view to exactly those car parks, which is how
you build a page for one operator, one district or one customer:

```html
<bolzano-parking-app parkings="103,104,105,112"></bolzano-parking-app>
```

The same selection is available interactively through the **Specific parkings**
filter, so on the standalone site a user can assemble a dashboard and share the
resulting link.

To lock a dashboard down, hide the filters:

```html
<bolzano-parking-app parkings="103,104,105,112" filters="none">
```

`filters` also takes a subset, e.g. `filters="municipality,status"` to offer
those two and hide the rest.

Municipality names are accepted in any language, as is the internal id — so
`municipalities="Bolzano - Bozen"`, `"Bozen"` and `"Bolzano"` all resolve to the
same place regardless of the `language` setting.

### URL state

On the **standalone site** the current filters are written to the query string
with `history.replaceState` and read back on load and on browser navigation, so
any view is linkable. **Embedded as a webcomponent this never happens** — a
component has no business rewriting its host page's URL.

That is a build-time distinction, not an attribute, so an integrator cannot
switch it on: `STANDALONE=true` is set on the two site deployment jobs, and
`vite serve` implies it so development matches production. Because only the
standalone site ever writes, the parameters need no namespace prefix.

URLs are meant to be read and hand-edited, so lists are plain comma-separated
values and nothing is JSON-encoded. `,` and `:` are left unescaped — both are
legal in a query value and escaping them only obscures the URL:

```
?municipality=osm:r47283,osm:r47519&origin=FAMAS,skidata&status=live
&parking=105,urn:parking:skidata:00058037-e9ee-50da-9478-e4d9861c2214
&search=fiera
```

| Parameter | Values |
|---|---|
| `municipality` | municipality ids |
| `origin` | data origins as the API names them |
| `status` | `live`, `delayed`, `static` |
| `parking` | station codes — what the API, the operators and the `parkings` attribute all use |
| `search` | free text |

Parkings are written as station codes rather than internal ids; the store maps
them back once data has loaded, so the URL and the `parkings` attribute take the
same values. Any parameter the component does not own is copied through
untouched.

### Theming

Every colour, radius and font is a CSS custom property on the host, so an
integrator can restyle without forking:

```css
bolzano-parking-app {
  --color-primary: #7b3fa0;
  --color-primary-strong: #5d2f7a;
}
```

The map and charts read the same tokens through `getComputedStyle`, so canvas
rendering follows any override.

## How it works

### Layout

Filters live in pills floating over the map rather than in a permanent column,
so they cost no layout space; each pill states its own current selection because
its panel is closed most of the time, and active filters also appear as
removable chips above the results.

The results list is a grid whose column count per breakpoint is a single
constant in `src/components/AppView.vue`:

```js
const LIST_COLUMNS = { wide: 2, medium: 1, narrow: 1 }
```

Selected parkings sort to the top of the list, so picking a marker on the map
never means hunting through hundreds of cards.

List cards carry a forecast sparkline with its bound values and time scale —
an auto-scaled curve on its own shows the shape of a forecast but nothing about
its size, so 44→48 would look identical to 0→500. Pass `:axis="false"` to
`Sparkline` for the bare curve where the surrounding context already supplies
the magnitude.

### Availability

Operators disagree about what "availability" even is, so each parking declares
an `availabilityKind` and the UI renders accordingly:

| Kind | Meaning | Sources |
|---|---|---|
| `count` | Exact free spaces | FAMAS, GARDENA, STA, skidata, municipalities, on-street sensors |
| `ratio` | Occupancy fraction, no absolute count | SBB (Swiss P+Rail) |
| `level` | Coarse LOW/MEDIUM/HIGH band | SBB fallback |
| `none` | Location only | Tourism POIs, stations publishing the 9999 capacity sentinel |

Freshness is a separate axis — `live`, `delayed` (shown with an alert), `static`,
or dropped entirely past `stale-max-age`.

On-street parking is drawn and labelled differently from a garage throughout: a
flattened marker on the map and an "On-street" badge on the card, because a
handful of metered bays is not the same kind of thing as a multi-storey.

### Municipality grouping

Parkings are grouped by point-in-polygon against bundled OpenStreetMap
`admin_level=8` boundaries, not by matching the inconsistent municipality
strings the operators publish. The filter list is derived from whatever the data
actually contains — there is no hardcoded list to maintain.

Regenerate the bundled boundaries with:

```bash
yarn geo:build    # ~2 min; caches ~250 MB of Overpass responses in .geo-cache/
```

The script prunes Europe-wide boundaries down to the municipalities near real
parkings, simplifies them, and fails the build if the asset exceeds its size
budget or if any live parking stops resolving.

Simplification is aggressive, which moves borders by a few metres — enough to
push a parking that sits right on one into the neighbouring municipality
(Bolzano airport did exactly that). So the build also resolves every known
parking against the *unsimplified* geometry and ships the result as a small
override map. Simplification therefore only governs coordinates the build has
never seen, and the fidelity check reports anything it pins.

### API usage

The mobility API is queried in three separate shapes so the recurring request
stays small:

- **metadata** — station identity and capacity; static, fetched once per 30 min,
  with nested field selection so SBB's pricing and opening-hours payloads never
  cross the wire
- **readings** — polled every `refresh-interval`
- **forecasts** — every station's headline forecast in one ~100 kB request on
  the slow cadence, so each list card can draw a sparkline; the low/high
  confidence band is fetched per station only when a detail opens

Tourism POIs are fetched once and never polled; that endpoint rate-limits
anonymous callers. Polling pauses while the page is hidden and stops when the
element is removed.

```bash
yarn verify:live                  # run the real pipeline and print what it yields
ENVIRONMENT=test yarn verify:live
```

## Licensing

Code is AGPL-3.0-or-later. The bundled municipality boundaries in
`src/assets/data/` are a derived database of OpenStreetMap data and are
therefore **ODbL-1.0 — © OpenStreetMap contributors**; the map credits both that
and the OSM tiles. Every dependency is OSI-approved and compatible with
AGPL-3.0-or-later.

This project is [REUSE](https://reuse.software) compliant. A pre-commit hook is
configured:

```bash
pip install pre-commit
pre-commit install
```
