// TODO: train a model based on sections to categorically sort new history based on content from bookmarks
const fs = require('fs')
const path = require('path')
const os = require('os') // Added missing os import from your context
const { createClient } = require('@libsql/client');

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

const BASE_DATE_STR = "1601-01-01T00:00:00+0000";
const BASE_DATE = new Date(Date.parse(BASE_DATE_STR))
const TIME_ZONE = (new Date).getTimezoneOffset() * 1000

function findHistoryFile() {
	let workingPaths = []
	let settingsPath

	if (os.platform() === 'win32') { // Fixed os.platform invocation syntax error
		settingsPath = path.join(HOMEPATH, 'AppData/Local')
	} else {
		if (os.platform() === 'darwin') {
			settingsPath = path.join(HOMEPATH, 'Library/Application Support')
		} else {
			settingsPath = path.join(HOMEPATH, '.config')
		}
	}

	workingPaths.push(path.join(settingsPath, 'Google/Chrome/Default/History'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/User Data/Default/History'))
	workingPaths.push(path.join(settingsPath, 'BraveSoftware/Brave-Browser/Default/History'))

	for (let i = 0; i < workingPaths.length; i++) {
		if (fs.existsSync(workingPaths[i])) {
			return workingPaths[i]
		}
	}
}

// Accepts optional JavaScript Date objects to bound the SQL query index
async function getHistory(startDate = null, endDate = null) {
	const HISTORY_FILE = findHistoryFile()
	if (!HISTORY_FILE) {
		throw new Error('Couldn\'t find Chrome history.')
	}
	const backupFile = HISTORY_FILE + '.backup';
	if (fs.existsSync(backupFile)) {
		fs.unlinkSync(backupFile)
	}
	fs.copyFileSync(HISTORY_FILE, backupFile)
	const client = createClient({
		url: `file:${backupFile}`,
		intMode: "bigint"
	});

	try {
		let sql = 'SELECT * FROM urls WHERE 1=1';
		let args = [];

		// Reverse engineering WebKit timestamp logic:
		// (Date.getTime() - Jan_1_1601_ms) * 1000 microseconds
		if (startDate) {
			const startMicroseconds = BigInt((startDate.getTime() - BASE_DATE.getTime()) * 1000);
			sql += ' AND last_visit_time >= ?';
			args.push(startMicroseconds);
		} else {
			// Default fallback if no date bounds are provided: Last 48 hours
			const legacyOffset = BigInt((Date.now() - BASE_DATE.getTime()) * 1000 - (60 * 60 * 2 * 24 * 1000000));
			sql += ' AND last_visit_time > ?';
			args.push(legacyOffset);
		}

		if (endDate) {
			const endMicroseconds = BigInt((endDate.getTime() - BASE_DATE.getTime()) * 1000);
			sql += ' AND last_visit_time <= ?';
			args.push(endMicroseconds);
		}

		// Order results oldest to newest cleanly
		sql += ' ORDER BY last_visit_time ASC';

		const rs = await client.execute({ sql, args });
		return rs.rows;
	} finally {
		client.close();
	}
}

async function listHistory(startDate = null, endDate = null) {
	let history = await getHistory(startDate, endDate)
	const EXCLUDED_HISTORY = [
		/accounts\.google/gi,
		/auth\//gi,
		/\/sso\//gi,
		/mail\.google/gi,
	]

	const filteredHistory = history.filter(entry =>
		!EXCLUDED_HISTORY.some(expr => entry.url.match(expr)) &&
		entry.title && entry.title.trim().length > 0
	);

	return filteredHistory.map(entry => {
		if (entry.title == 'Startpage Search Results' || entry.title == 'Google Search') {
			let match = (/\?q=([^&]*)/gi).exec(entry.url)
			entry.title = 'Search: ' + (match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '')
		}
		const msSince1601 = Number(entry.last_visit_time / 1000n);
		const startTime = new Date(msSince1601 + BASE_DATE.getTime() + TIME_ZONE);

		return {
			id: entry.id,
			content: entry.title.substring(0, 100) + `  <a target="_blank" href="${entry.url}">link &nearr;</a>`,
			start: startTime
		}
	})
}
// ====================================================================
// CLI INTERFACE EXECUTION BLOCK
// ====================================================================
if (require.main === module) {
	(async () => {
		const getArg = (flag) => {
			const index = process.argv.indexOf(flag);
			return (index !== -1 && process.argv[index + 1]) ? process.argv[index + 1] : null;
		};

		const startStr = getArg('--start');
		const endStr = getArg('--end');

		let startDate = startStr ? new Date(startStr) : null;
		let endDate = endStr ? new Date(endStr) : null;

		if (startStr && isNaN(startDate.getTime())) {
			console.error(`Invalid start date format: "${startStr}". Use YYYY-MM-DD.`);
			process.exit(1);
		}
		if (endStr && isNaN(endDate.getTime())) {
			console.error(`Invalid end date format: "${endStr}". Use YYYY-MM-DD.`);
			process.exit(1);
		}

		try {
			console.log(`Querying history bounds: [${startDate ? startDate.toISOString() : 'Earliest'}] to [${endDate ? endDate.toISOString() : 'Latest'}]...`);

			// Re-fetch history matching the date parameters
			const historyRows = await getHistory(startDate, endDate);

			// Re-apply exclusion criteria identical to listHistory
			const EXCLUDED_HISTORY = [
				/accounts\.google/gi,
				/auth\//gi,
				/\/sso\//gi,
				/mail\.google/gi,
			];

			const filtered = historyRows.filter(entry =>
				!EXCLUDED_HISTORY.some(expr => entry.url.match(expr)) &&
				entry.title && entry.title.trim().length > 0
			);

			if (filtered.length === 0) {
				console.log("No matching browser history records located inside that timeline.");
				return;
			}

			filtered.forEach(entry => {
				// Parse standard search queries cleanly
				if (entry.title == 'Startpage Search Results' || entry.title == 'Google Search') {
					let match = (/\?q=([^&]*)/gi).exec(entry.url);
					entry.title = 'Search: ' + (match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '');
				}

				// Compute local system timestamp format
				const msSince1601 = Number(entry.last_visit_time / 1000n);
				const startTime = new Date(msSince1601 + BASE_DATE.getTime() + TIME_ZONE);
				const timestamp = startTime.toLocaleString();

				// Pristine terminal layout printing the raw readable text AND raw URL string
				console.log(`[${timestamp}] ${entry.title.substring(0, 100)} -> ${entry.url}`);
			});
		} catch (err) {
			console.error("Execution Error:", err.message);
			process.exit(1);
		}
	})();
}

module.exports = {
	getHistory,
	listHistory,
}