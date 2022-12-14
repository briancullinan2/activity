// TODO: show browsing history

// TODO: train a model based on sections to categorically sort new history based on content from bookmarks
const fs = require('fs')
const path = require('path')
const sqlite3 = require('better-sqlite3');

// TODO: import from History database or from export

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

const BASE_DATE_STR = "1601-01-01T00:00:00+0000";
const BASE_DATE = new Date(Date.parse(BASE_DATE_STR))
const TIME_ZONE = (new Date).getTimezoneOffset() * 1000

function findHistoryFile() {
	let workingPaths = []
	let settingsPath

	if (os.platform == 'win32') {
		settingsPath = path.join(HOMEPATH, 'AppData\/LocalStorage')
	} else {
		if (os.platform == 'darwin') {
			settingsPath = path.join(HOMEPATH, 'Library\/Application\ Support')
		} else {
			settingsPath = path.join(HOMEPATH, '.config')
		}
	}

	//workingPaths.push(path.join(settingsPath, 'BraveSoftware\/Brave-Browser\/Default\/History'))
	workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/Default/History'))

	for (let i = 0; i < workingPaths.length; i++) {
		if (fs.existsSync(workingPaths[i])) {
			return workingPaths[i]
		}
	}
}

function getHistory() {
	const HISTORY_FILE = findHistoryFile()
	if(fs.existsSync(HISTORY_FILE + '.backup')) {
		fs.unlinkSync(HISTORY_FILE + '.backup')
	}
	fs.copyFileSync(HISTORY_FILE, HISTORY_FILE + '.backup')
	const db = new sqlite3(HISTORY_FILE + '.backup', {
		readonly: true,
		fileMustExist: true,
	})

	// reverse of chromeDtToDate
	const todayOffset = (Date.now() - BASE_DATE.getTime()) * 1000 - (60 * 60 * 2 * 24 * 1000000)
	const results = db.prepare('SELECT * FROM urls WHERE last_visit_time > ?').all(todayOffset)
	//console.log(results)
	return results
}

function listHistory() {
	let history = getHistory()
	// nice side-effect, this will make the listings a little more interesting anyways
	const EXCLUDED_HISTORY = [
		/accounts\.google/gi,
		/auth\//gi,
		/\/sso\//gi,
		/mail\.google/gi, // not quite ready for people to read my emails
	]

	let filteredHistory = history.filter(entry => EXCLUDED_HISTORY
			.filter(expr => entry.url.match(expr)).length == 0
				&& entry.title.trim().length > 0)
			
//"start": "2022-09-07T13:19:14.428Z"
//"start": "2022-09-07T06:44:13.579Z"
	return filteredHistory.map(entry => {
		if(entry.title == 'Startpage Search Results') {
			let match = (/\?q=([^&]*)/gi).exec(entry.url)
			entry.title = 'Search: ' + (match ? match[1].replace(/\+/g, ' ') : '')
		}
		return { 
			id: entry.id, 
			content: entry.title.substring(0, 100) + `  <a target="_blank" href="${entry.url}">link &nearr;</a>`, 
			start: new Date((entry.last_visit_time / 1000 + BASE_DATE.getTime() + TIME_ZONE))
		}
	})
}

module.exports = {
	getHistory,
	listHistory,
}
