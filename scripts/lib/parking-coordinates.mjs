// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/**
 * Every coordinate the app can currently show, from production *and* test.
 *
 * Shared by the boundary build and the coverage check so the two can never
 * disagree about what "all the parkings" means — a check that looked at a
 * different set than the build would be worse than no check.
 */

const MOBILITY_HOSTS = [
  'https://mobility.api.opendatahub.com',
  'https://mobility.api.opendatahub.testingmachine.eu',
]
const CONTENT_HOSTS = [
  'https://tourism.api.opendatahub.com',
  'https://tourism.api.opendatahub.testingmachine.eu',
]

/** "Parking" tag in the Open Data Hub content taxonomy. */
const PARKING_TAG = '264369BEFCC0461C9C585C867DD0CC88'

export async function fetchParkingCoordinates({ log = () => {} } = {}) {
  const points = []
  const seen = new Set()
  const push = (lon, lat, label) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`
    if (seen.has(key)) return
    seen.add(key)
    points.push({ lon, lat, label })
  }

  for (const host of MOBILITY_HOSTS) {
    for (const type of ['ParkingStation', 'ParkingSensor']) {
      const url =
        `${host}/v2/flat,node/${type}/*/latest` +
        `?limit=-1&where=sactive.eq.true&select=scoordinate,scode,sname&origin=webcomp-parking-app`
      try {
        const res = await fetch(url)
        const json = await res.json()
        for (const row of json.data ?? []) {
          push(row.scoordinate?.x, row.scoordinate?.y, row.sname || row.scode)
        }
        log(`${type} @ ${new URL(host).hostname}: ${json.data?.length ?? 0} rows`)
      } catch (err) {
        log(`WARN ${type} @ ${host} failed: ${err.message}`)
      }
    }
  }

  for (const host of CONTENT_HOSTS) {
    const url =
      `${host}/v1/ODHActivityPoi?tagfilter=${PARKING_TAG}` +
      `&pagenumber=1&pagesize=1000&removenullvalues=true&fields=Id,Detail,GpsInfo` +
      `&origin=webcomp-parking-app`
    try {
      const res = await fetch(url)
      const json = await res.json()
      for (const item of json.Items ?? []) {
        const gps = item.GpsInfo?.[0]
        if (gps) push(gps.Longitude, gps.Latitude, item.Detail?.en?.Title ?? item.Id)
      }
      log(`POIs @ ${new URL(host).hostname}: ${json.Items?.length ?? 0} items`)
    } catch (err) {
      log(`WARN POIs @ ${host} failed: ${err.message}`)
    }
  }

  if (!points.length) {
    throw new Error('no parking coordinates fetched')
  }
  return points
}

/** Loads the committed boundary asset from disk. */
export async function loadCommittedDataset() {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath, URL: NodeURL } = await import('node:url')
  const { createDataset } = await import('../../src/lib/geo/municipalities.js')

  const dir = fileURLToPath(new NodeURL('../../src/assets/data/', import.meta.url))
  const [topo, index, overrides] = await Promise.all([
    readFile(`${dir}municipalities.topo.json`, 'utf8').then(JSON.parse),
    readFile(`${dir}municipalities.index.json`, 'utf8').then(JSON.parse),
    readFile(`${dir}municipalities.overrides.json`, 'utf8').then(JSON.parse),
  ])
  return createDataset(topo, index, overrides)
}
