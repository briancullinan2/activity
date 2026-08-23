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
 * 2. PARSE AND EXTRACT THE LAST 30 DAYS OF VISITS & PATHS
 */
function parseTimelineData(filePath) {
    console.log(`[+] Parsing: ${filePath}`);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const mapData = {
        places: [],
        lines: []
    };

    // Fallback array check based on different Google export paradigms
    const segments = rawData.semanticSegments || rawData.locations || [];

    segments.forEach(segment => {
        // Extract timestamps safely
        const startTimeStr = segment.startTime || segment.timestamp || (segment.visit && segment.visit.startTime);
        if (!startTimeStr) return;

        const segmentTime = new Date(startTimeStr);
        if (segmentTime < oneMonthAgo) return;

        // Process places/visits
        if (segment.visit) {
            const topCandidate = segment.visit.topCandidate;
            if (topCandidate && topCandidate.placeLocation && topCandidate.placeLocation.latLng) {
                // Handle text formatted latLng string matching e.g., "35.19828°, -111.65130°"
                const match = topCandidate.placeLocation.latLng.match(/(-?\d+\.\d+)/g);
                if (match && match.length >= 2) {
                    mapData.places.push({
                        name: topCandidate.semanticType || topCandidate.name || "Visited Place",
                        lat: parseFloat(match[0]),
                        lng: parseFloat(match[1]),
                        time: segmentTime.toLocaleString()
                    });
                }
            }
        }

        // Process pathways / paths
        if (segment.timelinePath && segment.timelinePath.length > 0) {
            const currentLineCoordinates = [];
            segment.timelinePath.forEach(p => {
                if (p.point && p.point.startsWith('geo:')) {
                    const coords = p.point.replace('geo:', '').split(',');
                    if (coords.length >= 2) {
                        currentLineCoordinates.push([parseFloat(coords[0]), parseFloat(coords[1])]);
                    }
                }
            });
            if (currentLineCoordinates.length > 1) {
                mapData.lines.push(currentLineCoordinates);
            }
        }

        // Alternative standard location historical logs check (E7 formatting parsing fallback)
        if (segment.latitudeE7 && segment.longitudeE7) {
            const lat = segment.latitudeE7 / 10000000;
            const lng = segment.longitudeE7 / 10000000;
            mapData.places.push({
                name: "Location Ping",
                lat: lat,
                lng: lng,
                time: segmentTime.toLocaleString()
            });
        }
    });

    return mapData;
}
/**
 * 3. GENERATE UNIFIED SPA VIEW TEMPLATE HTML (CSP Compliant)
 */
function generateTimeline(mapData) {
    // Encodes quotes and special characters to safely embed inside a data attribute
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

/**
 * 4. SYSTEM ENTRY & LIFECYCLE
 */
function main() {
    const timelinePath = findLatestTimelineFile();

    if (!timelinePath) {
        console.error("[-] Error: No matching Timeline JSON target located inside your Downloads folder.");
        process.exit(1);
    }

    const payload = parseTimelineData(timelinePath);
    const htmlOutput = generateHTML(payload);

    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlOutput);
    });

    server.listen(PORT, () => {
        console.log(`[+] Dashboard online & pipeline active.`);
        console.log(`[+] Navigate to: http://localhost:${PORT}`);
        console.log(`[!] Press Ctrl+C to stop local engine hosting.`);
    });
}
