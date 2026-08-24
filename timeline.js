#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const USER_HOME = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
const DOWNLOADS_DIR = path.join(USER_HOME, 'Downloads');

function findLatestTimelineFile() {
    if (!fs.existsSync(DOWNLOADS_DIR)) return null;

    const files = fs.readdirSync(DOWNLOADS_DIR);
    const timelineFiles = files.filter(f =>
        f.toLowerCase().includes('timeline') && f.endsWith('.json')
    );

    if (timelineFiles.length === 0) return null;

    const sorted = timelineFiles.map(name => {
        const filePath = path.join(DOWNLOADS_DIR, name);
        return { path: filePath, mtime: fs.statSync(filePath).mtime };
    }).sort((a, b) => b.mtime - a.mtime);

    return sorted[0].path;
}

function parseTimelineData(filePath) {
    console.log(`[+] Parsing file: ${filePath}`);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    const mapData = {
        places: [],
        lines: [],
        pings: []
    };

    const allPings = [];

    function parseDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    // Helper to parse coordinate representations across Google formats
    function extractCoords(obj) {
        if (!obj || typeof obj !== 'object') return null;

        // Pattern A: "LatLng": "35.2095778°, -111.5850568°" or "35.209,-111.585"
        if (typeof obj.LatLng === 'string') {
            const matches = obj.LatLng.match(/(-?\d+\.\d+)/g);
            if (matches && matches.length >= 2) {
                return { lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
            }
        }

        // Pattern B: geo: URI strings
        if (typeof obj.point === 'string' && obj.point.startsWith('geo:')) {
            const parts = obj.point.replace('geo:', '').split(',');
            if (parts.length >= 2) {
                return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
            }
        }

        // Pattern C: latitudeE7 / longitudeE7
        if (typeof obj.latitudeE7 === 'number' && typeof obj.longitudeE7 === 'number') {
            return { lat: obj.latitudeE7 / 1e7, lng: obj.longitudeE7 / 1e7 };
        }

        // Pattern D: Standard numeric lat/lng or latitude/longitude
        const latVal = obj.lat ?? obj.latitude;
        const lngVal = obj.lng ?? obj.longitude;
        if (typeof latVal === 'number' && typeof lngVal === 'number') {
            return { lat: latVal, lng: lngVal };
        }

        return null;
    }

    function walk(node) {
        if (!node || typeof node !== 'object') return;

        // Process place visits
        if (node.visit && node.visit.topCandidate) {
            const candidate = node.visit.topCandidate;
            const coords = extractCoords(candidate.placeLocation) || extractCoords(candidate.location);
            const time = parseDate(node.startTime || node.visit.startTime);

            if (coords && time && time >= oneMonthAgo) {
                mapData.places.push({
                    name: candidate.semanticType || candidate.name || "Visited Place",
                    lat: coords.lat,
                    lng: coords.lng,
                    time: time.toLocaleString()
                });
            }
        }

        // Process position and waypoint nodes
        const coords = extractCoords(node);
        if (coords) {
            const time = parseDate(node.timestamp || node.startTime || node.time || node.deliveryTime);
            if (time && time >= oneMonthAgo) {
                allPings.push({ lat: coords.lat, lng: coords.lng, time });
            }
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) walk(node[i]);
        } else {
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    walk(node[key]);
                }
            }
        }
    }

    walk(rawData);

    // Sort chronologically
    allPings.sort((a, b) => a.time - b.time);
    mapData.pings = allPings.map(p => [p.lat, p.lng]);

    // Group pings into travel paths (break on 30-minute gaps)
    let currentSegment = [];
    for (let i = 0; i < allPings.length; i++) {
        const ping = allPings[i];
        if (currentSegment.length === 0) {
            currentSegment.push([ping.lat, ping.lng]);
            continue;
        }

        const prevPing = allPings[i - 1];
        const gapMinutes = (ping.time - prevPing.time) / (1000 * 60);

        if (gapMinutes > 30) {
            if (currentSegment.length > 1) {
                mapData.lines.push(currentSegment);
            }
            currentSegment = [[ping.lat, ping.lng]];
        } else {
            const lastCoord = currentSegment[currentSegment.length - 1];
            if (lastCoord[0] !== ping.lat || lastCoord[1] !== ping.lng) {
                currentSegment.push([ping.lat, ping.lng]);
            }
        }
    }
    if (currentSegment.length > 1) {
        mapData.lines.push(currentSegment);
    }

    console.log(`[+] Total raw waypoints extracted: ${allPings.length}`);
    console.log(`[+] Continuous path segments generated: ${mapData.lines.length}`);

    return mapData;
}


let GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || null;
if (fs.existsSync(path.join(USER_HOME, '.credentials', 'places.txt'))) {
    GOOGLE_API_KEY = fs.readFileSync(path.join(USER_HOME, '.credentials', 'places.txt'));
}

/**
 * OpenStreetMap Overpass API Lookup
 */
function lookupBusinessOSM(lat, lng, radiusMeters = 35) {
    return new Promise((resolve) => {
        const query = `[out:json][timeout:5];(node(around:${radiusMeters},${lat},${lng})["name"];way(around:${radiusMeters},${lat},${lng})["name"];);out center 1;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        const req = https.get(url, { headers: { 'User-Agent': 'TimelineParser/1.0' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.elements && data.elements.length > 0) {
                        const tags = data.elements[0].tags || {};
                        return resolve(tags.name || tags.brand || null);
                    }
                } catch (_) { }
                resolve(null);
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    });
}

/**
 * Google Places API (Nearby Search / New Places API) Fallback
 */
function lookupBusinessGoogle(lat, lng, radiusMeters = 35) {
    return new Promise((resolve) => {
        if (!GOOGLE_API_KEY) return resolve(null);

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&key=${GOOGLE_API_KEY}`;

        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.results && data.results.length > 0) {
                        return resolve(data.results[0].name || null);
                    }
                } catch (_) { }
                resolve(null);
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    });
}

/**
 * Dual lookup: Attempts OSM first; falls back to Google Places API
 */
async function resolveBusinessName(lat, lng) {
    let name = await lookupBusinessOSM(lat, lng);
    if (!name && GOOGLE_API_KEY) {
        name = await lookupBusinessGoogle(lat, lng);
    }
    return name;
}

/**
 * Cluster GPS pings to identify stationary stops (> minStopMinutes)
 */
function findStops(allPings, minStopMinutes = 10, maxRadiusKm = 0.05) {
    const stops = [];
    if (!allPings || allPings.length === 0) return stops;

    let cluster = [allPings[0]];

    for (let i = 1; i < allPings.length; i++) {
        const ping = allPings[i];
        const center = cluster[0];

        const dist = getDistanceKm(center.lat, center.lng, ping.lat, ping.lng);

        if (dist <= maxRadiusKm) {
            cluster.push(ping);
        } else {
            const durationMins = (cluster[cluster.length - 1].time - cluster[0].time) / (1000 * 60);
            if (durationMins >= minStopMinutes) {
                stops.push({
                    lat: center.lat,
                    lng: center.lng,
                    durationMins: Math.round(durationMins),
                    startTime: cluster[0].time
                });
            }
            cluster = [ping];
        }
    }
    return stops;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Core async parsing pipeline with 1% progress throttled logging
 */
async function parseTimelineDataAsync(filePath) {
    console.log(`[+] Parsing file: ${filePath}`);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    const mapData = {
        places: [],
        lines: [],
        pings: []
    };

    const allPings = [];

    function parseDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function extractCoords(obj) {
        if (!obj || typeof obj !== 'object') return null;

        if (typeof obj.LatLng === 'string') {
            const matches = obj.LatLng.match(/(-?\d+\.\d+)/g);
            if (matches && matches.length >= 2) {
                return { lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
            }
        }
        if (typeof obj.point === 'string' && obj.point.startsWith('geo:')) {
            const parts = obj.point.replace('geo:', '').split(',');
            if (parts.length >= 2) {
                return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
            }
        }
        if (typeof obj.latitudeE7 === 'number' && typeof obj.longitudeE7 === 'number') {
            return { lat: obj.latitudeE7 / 1e7, lng: obj.longitudeE7 / 1e7 };
        }
        const latVal = obj.lat ?? obj.latitude;
        const lngVal = obj.lng ?? obj.longitude;
        if (typeof latVal === 'number' && typeof lngVal === 'number') {
            return { lat: latVal, lng: lngVal };
        }

        return null;
    }

    function walk(node) {
        if (!node || typeof node !== 'object') return;

        if (node.visit && node.visit.topCandidate) {
            const candidate = node.visit.topCandidate;
            const coords = extractCoords(candidate.placeLocation) || extractCoords(candidate.location);
            const time = parseDate(node.startTime || node.visit.startTime);

            if (coords && time && time >= oneMonthAgo) {
                mapData.places.push({
                    name: candidate.semanticType || candidate.name || "Visited Place",
                    lat: coords.lat,
                    lng: coords.lng,
                    time: time.toLocaleString()
                });
            }
        }

        const coords = extractCoords(node);
        if (coords) {
            const time = parseDate(node.timestamp || node.startTime || node.time || node.deliveryTime);
            if (time && time >= oneMonthAgo) {
                allPings.push({ lat: coords.lat, lng: coords.lng, time });
            }
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) walk(node[i]);
        } else {
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    walk(node[key]);
                }
            }
        }
    }

    walk(rawData);

    allPings.sort((a, b) => a.time - b.time);
    mapData.pings = allPings.map(p => [p.lat, p.lng]);

    // Generate line segments
    let currentSegment = [];
    for (let i = 0; i < allPings.length; i++) {
        const ping = allPings[i];
        if (currentSegment.length === 0) {
            currentSegment.push([ping.lat, ping.lng]);
            continue;
        }

        const prevPing = allPings[i - 1];
        const gapMinutes = (ping.time - prevPing.time) / (1000 * 60);

        if (gapMinutes > 30) {
            if (currentSegment.length > 1) mapData.lines.push(currentSegment);
            currentSegment = [[ping.lat, ping.lng]];
        } else {
            const lastCoord = currentSegment[currentSegment.length - 1];
            if (lastCoord[0] !== ping.lat || lastCoord[1] !== ping.lng) {
                currentSegment.push([ping.lat, ping.lng]);
            }
        }
    }
    if (currentSegment.length > 1) mapData.lines.push(currentSegment);

    // Identify stationary stops
    const detectedStops = findStops(allPings, 10);
    const totalStops = detectedStops.length;

    console.log(`[+] Total pings loaded: ${allPings.length}`);
    console.log(`[+] Found ${totalStops} stationary stops (>10 min). Resolving business names...`);

    let lastLoggedPercent = -1;

    for (let i = 0; i < totalStops; i++) {
        const stop = detectedStops[i];

        // Reverse lookups
        const businessName = await resolveBusinessName(stop.lat, stop.lng);

        mapData.places.push({
            name: businessName ? `Visited: ${businessName}` : `Stopped (${stop.durationMins} mins)`,
            lat: stop.lat,
            lng: stop.lng,
            time: stop.startTime.toLocaleString()
        });

        // Throttle console output to at most every 1% step
        const currentPercent = Math.floor(((i + 1) / totalStops) * 100);
        if (currentPercent > lastLoggedPercent) {
            console.log(`[+] Business Resolution Progress: ${currentPercent}% (${i + 1}/${totalStops})`);
            lastLoggedPercent = currentPercent;
        }
    }

    return mapData;
}


function generateTimeline(mapData) {
    // Encode safely via Base64 to prevent HTML attribute string corruption
    const jsonBuffer = Buffer.from(JSON.stringify(mapData)).toString('base64');

    return `
    <div class="dashboard-overlay">
        <h2>Timeline Route Hub</h2>
        <div class="subtitle">Embedded Environment Diagnostics</div>
        <div class="metric-row"><span>Log Duration</span><span>Past 30 Days</span></div>
        <div class="metric-row"><span>Waypoints Loaded</span><span>${mapData.pings.length}</span></div>
        <div class="metric-row"><span>Trace Pathways</span><span>${mapData.lines.length}</span></div>
    </div>

    <div id="map" data-timeline="${jsonBuffer}"></div>
    `;
}

module.exports = {
    generateTimeline,
    parseTimelineData,
    findLatestTimelineFile,
    parseTimelineDataAsync
};