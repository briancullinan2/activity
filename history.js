// TODO: show browsing history

// TODO: train a model based on sections to categorically sort new history based on content from bookmarks
const fs = require('fs')
const path = require('path')
const { createClient } = require('@libsql/client');

// TODO: import from History database or from export

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

const BASE_DATE_STR = "1601-01-01T00:00:00+0000";
const BASE_DATE = new Date(Date.parse(BASE_DATE_STR))
const TIME_ZONE = (new Date).getTimezoneOffset() * 1000

function findHistoryFile() {
	let workingPaths = []
	let settingsPath

	if (os.platform == 'win32') {
		settingsPath = path.join(HOMEPATH, 'AppData\/Local')
	} else {
		if (os.platform == 'darwin') {
			settingsPath = path.join(HOMEPATH, 'Library\/Application\ Support')
		} else {
			settingsPath = path.join(HOMEPATH, '.config')
		}
	}

	//workingPaths.push(path.join(settingsPath, 'BraveSoftware\/Brave-Browser\/Default\/History'))
	workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/Default/History'))
	workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/User Data/Default/History'))
	workingPaths.push(path.join(settingsPath, 'BraveSoftware/Brave-Browser/Default/History'))

	for (let i = 0; i < workingPaths.length; i++) {
		if (fs.existsSync(workingPaths[i])) {
			return workingPaths[i]
		}
	}
}

async function getHistory() {
	const HISTORY_FILE = findHistoryFile()
	if(!HISTORY_FILE)
	{
		throw new Error('Couldn\'t find Chrome history.')
	}
	const backupFile = HISTORY_FILE + '.backup';
	if(fs.existsSync(backupFile)) {
		fs.unlinkSync(backupFile)
	}
	fs.copyFileSync(HISTORY_FILE, backupFile)
	const client = createClient({
        url: `file:${backupFile}`,
		intMode: "bigint"
    });

    const todayOffset = (Date.now() - BASE_DATE.getTime()) * 1000 - (60 * 60 * 2 * 24 * 1000000);
    
    try {
        const rs = await client.execute({
            sql: 'SELECT * FROM urls WHERE last_visit_time > ?',
            args: [todayOffset]
        });
        
        // libsql returns rows as an array of objects
        return rs.rows;
    } finally {
        // We close the client but keep the backup for the map function to finish
        client.close();
    }
}

async function listHistory() {
	let history = await getHistory()
	// nice side-effect, this will make the listings a little more interesting anyways
	const EXCLUDED_HISTORY = [
		/accounts\.google/gi,
		/auth\//gi,
		/\/sso\//gi,
		/mail\.google/gi, // not quite ready for people to read my emails
	]

	const filteredHistory = history.filter(entry => 
        !EXCLUDED_HISTORY.some(expr => entry.url.match(expr)) && 
        entry.title && entry.title.trim().length > 0
    );
			
//"start": "2022-09-07T13:19:14.428Z"
//"start": "2022-09-07T06:44:13.579Z"
	return filteredHistory.map(entry => {
		if(entry.title == 'Startpage Search Results') {
			let match = (/\?q=([^&]*)/gi).exec(entry.url)
			entry.title = 'Search: ' + (match ? match[1].replace(/\+/g, ' ') : '')
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

module.exports = {
	getHistory,
	listHistory,
}
