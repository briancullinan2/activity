#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const PORT = 8080;
const USER_HOME = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
const DOWNLOADS_DIR = path.join(USER_HOME, 'Downloads');

/**
 * 1. SCAN DOWNLOADS FOR THE NEWEST TIMELINE EXPORT
 */
function findLatestTimelineFile() {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
        console.error(`[-] Downloads folder not found at: ${DOWNLOADS_DIR}`);
        return null;
    }

    const files = fs.readdirSync(DOWNLOADS_DIR);
    // Matches patterns like Timeline.json, Takeout Timeline.json, location_history.json etc.
    const timelineFiles = files.filter(f =>
        f.toLowerCase().includes('timeline') && f.endsWith('.json')
    );

    if (timelineFiles.length === 0) {
        return null;
    }

    // Sort by modification time descending
    const sorted = timelineFiles.map(name => {
        const filePath = path.join(DOWNLOADS_DIR, name);
        return { path: filePath, mtime: fs.statSync(filePath).mtime };
    }).sort((a, b) => b.mtime - a.mtime);

    return sorted[0].path;
}

/**
 * 2. RECURSIVELY EXTRACT ALL RAW PINGS & VISITS FROM LAST 30 DAYS
 */
function parseTimelineData(filePath) {
    console.log(`[+] Parsing file: ${filePath}`);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    const mapData = {
        places: [],
        lines: []
    };

    const allPings = [];

    // Helper to safely parse any timestamp variant
    function parseDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    // Recursive function to walk every node in the export JSON
    function walk(node) {
        if (!node || typeof node !== 'object') return;

        // Extract explicit place visits
        if (node.visit && node.visit.topCandidate && node.visit.topCandidate.placeLocation) {
            const time = parseDate(node.startTime || node.visit.startTime);
            if (time && time >= oneMonthAgo) {
                const match = (node.visit.topCandidate.placeLocation.latLng || '').match(/(-?\d+\.\d+)/g);
                if (match && match.length >= 2) {
                    mapData.places.push({
                        name: node.visit.topCandidate.semanticType || node.visit.topCandidate.name || "Visited Place",
                        lat: parseFloat(match[0]),
                        lng: parseFloat(match[1]),
                        time: time.toLocaleString()
                    });
                }
            }
        }

        // Check for coordinates on current node
        let lat = null, lng = null;
        if (node.latitudeE7 && node.longitudeE7) {
            lat = node.latitudeE7 / 1e7;
            lng = node.longitudeE7 / 1e7;
        } else if (node.position && typeof node.position.lat === 'number') {
            lat = node.position.lat;
            lng = node.position.lng;
        } else if (typeof node.point === 'string' && node.point.startsWith('geo:')) {
            const parts = node.point.replace('geo:', '').split(',');
            if (parts.length >= 2) {
                lat = parseFloat(parts[0]);
                lng = parseFloat(parts[1]);
            }
        }

        if (lat !== null && lng !== null) {
            const time = parseDate(node.timestamp || node.startTime || node.time);
            if (time && time >= oneMonthAgo) {
                allPings.push({ lat, lng, time });
            }
        }

        // Traverse arrays and child objects
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

    // Sort all extracted pings chronologically
    allPings.sort((a, b) => a.time - b.time);

    // Group sequential pings into continuous travel paths (break if gap > 45 mins)
    let currentSegment = [];
    for (let i = 0; i < allPings.length; i++) {
        const ping = allPings[i];
        if (currentSegment.length === 0) {
            currentSegment.push([ping.lat, ping.lng]);
            continue;
        }

        const prevPing = allPings[i - 1];
        const gapMinutes = (ping.time - prevPing.time) / (1000 * 60);

        if (gapMinutes > 45) {
            if (currentSegment.length > 1) {
                mapData.lines.push(currentSegment);
            }
            currentSegment = [[ping.lat, ping.lng]];
        } else {
            // Deduplicate identical sequential coordinates
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

function generateTimeline(mapData) {
    const serializedData = JSON.stringify(mapData)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `
    <div class="dashboard-overlay">
        <h2>Timeline Route Hub</h2>
        <div class="subtitle">Embedded Environment Diagnostics</div>
        <div class="metric-row"><span>Log Duration</span><span>Past 30 Days</span></div>
        <div class="metric-row"><span>Waypoints Loaded</span><span>${mapData.places.length}</span></div>
        <div class="metric-row"><span>Trace Pathways</span><span>${mapData.lines.length}</span></div>
    </div>

    <div id="map" data-timeline="${serializedData}"></div>
    `;
}

module.exports = {
    generateTimeline,
    parseTimelineData,
    findLatestTimelineFile
}
