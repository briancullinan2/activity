
// TODO: share some thoughts from calendar recordings, maybe a color/emotion or a new calendar for software ideas
const fs = require('fs')
const path = require('path')
const assert = require('assert');
const util = require('util');
const { google } = require('googleapis');
const { authorize } = require('./authorize.js')

let calendarList = [], lastCalendar;
const CALENDAR_NAMES = [
	'Diet', 'Emotions', 'General', 'Iga', 'megamindbrian@gmail.com',
	'Predictions', 'Revelation', 'Robot do'
]
const PUBLIC_CALENDARS = [
	'Diet', 'General', 'Revelation', 'Robot do'
]

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

async function filterCalendar(options) {
	let rexexp = new RegExp(options.calendarId, 'ig');
	let matches = calendarList
		.filter(c => c.id == options.calendarId);
	if (matches.length == 0) {
		matches = calendarList
			.filter(c => c.summary.match(rexexp));
	}
	assert(matches.length > 0, 'something is seriously wrong with the calendarId ' + JSON.stringify(options, null, 4) + JSON.stringify(calendarList, null, 4));
	if (lastCalendar !== matches[0].summary) {
		lastCalendar = matches[0].summary;
		console.log('Using calendar: ' + matches[0].summary
			+ ' - ' + matches[0].id);
	}
	options.calendarId = matches[0].id;
	return options
}

let calendar

async function correctCalendarId(options) {
	if (typeof options.calendarId === 'undefined' || options.calendarId === 'primary') {
		return Promise.resolve(Object.assign(options, {
			calendarId: 'primary'
		}))
	}
	if (calendarList.length > 0) {
		return filterCalendar(options);
	}
	let r
	if (calendarList.length == 0) {
		if (!calendar) {
			let client = authorize()
			calendar = google.calendar({ version: 'v3', auth: client })
		}
		r = util.promisify(calendar.calendarList.list.bind(calendar))()
	} else {
		r = calendarList
	}
	calendarList = (r.data || {}).items || []
	return await filterCalendar(options)
}


async function searchCalendar(search, calendarId) {
	const options = {}
	if (calendarId) {
		options.calendarId = calendarId;
	}
	if (!options.auth) {
		options.auth = await authorize(options.scopes)
	}
	calendar = google.calendar({ version: 'v3', auth: options.auth })
	await correctCalendarId(options)
	let searchTerms = search.split('|')
	let events = []
	for (let i = 0; i < searchTerms.length; i++) {
		let r = await listEvents({
			auth: options.auth,
			calendarId: options.calendarId,
			q: searchTerms[i]
		})
		console.log(term)
		console.log(r.map(e => e.event.summary).slice(0, 10))
		events.push.apply(events, r)
	}
	return events
}


async function listCalendar() {
	//let events = await searchCalendar('brainstorm', 'primary')
	//console.log(events)
	// TODO: scan events from .ical calendar export type, instead of relying on Google calendar services
	// find latest takeout items
	const takeouts = fs.readdirSync(path.join(HOMEPATH, 'Downloads'))
		.filter(dir => {
			return dir && dir.startsWith('Takeout')
				&& fs.existsSync(path.join(HOMEPATH, 'Downloads', dir, 'Calendar/General.ics'))
		})
		.map(dir => path.join(HOMEPATH, 'Downloads', dir, 'Calendar'))
	takeouts.sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime)

	const calendarList = CALENDAR_NAMES.reduce((obj, key) => {
		obj[key] = []
		return obj
	}, {})

	let eventId = 1
	//
	console.log(takeouts)

	Object.keys(calendarList).forEach((k, id) => {
		if (!fs.existsSync(path.join(takeouts[0], k + '.ics'))) {
			return
		}
		let calendarLines = fs.readFileSync(path.join(takeouts[0], k + '.ics'))
			.toString('utf-8').split('\n')


		let startLine = 0
		let currentEvent = {}
		let insideSummary = false
		let insideDescription = false

		calendarLines.forEach((line, i) => {
			if (line.startsWith('BEGIN:VEVENT')) {
				startLine = i
				currentEvent = {}
			} else
				if (line.startsWith('END:VEVENT')) {
					if (!currentEvent.start) {
						console.log(calendarLines.slice(startLine, i))
						debugger
					}
					if (PUBLIC_CALENDARS.includes(k)) {
						calendarList[k].push({
							id: ++eventId,
							group: id,
							content: (currentEvent.summary || '')
								.replace(/\\n/g, '\n')
								.replace(/\\,/g, ',')
								+ '<br />' + (currentEvent.description || '')
								.replace(/\\n/g, '\n')
								.replace(/\\,/g, ',')
								,
							start: currentEvent.start,
							type: 'box'
						})
					} else {
						calendarList[k].push({
							id: ++eventId,
							group: id,
							content: k,
							start: currentEvent.start,
							type: 'box'
						})
					}
				} else
					if (line.startsWith('DTSTART:')) {
						let dateString = line.substr('DTSTART:'.length)
						currentEvent.start = new Date(
							dateString.substr(0, 4),
							dateString.substr(4, 2),
							dateString.substr(6, 2),
							dateString.substr(9, 2),
							dateString.substr(11, 2),
							dateString.substr(13, 2))
					} else
						if (line.startsWith('DTSTART;')) {
							let dateString = line.substr(line.indexOf(':') + 1)
							currentEvent.start = new Date(
								dateString.substr(0, 4),
								dateString.substr(4, 2),
								dateString.substr(6, 2))
						} else
							if (line.startsWith('DTEND:')) {
								//currentEvent.start = new Date(line.substr('DTEND:'.length))
							} else
								if (line.startsWith('SUMMARY:')) {
									if (PUBLIC_CALENDARS.includes(k)) {
										currentEvent.summary = line.substr('SUMMARY:'.length)
									}
								} else
									if (line.startsWith('DESCRIPTION:')) {
										if (PUBLIC_CALENDARS.includes(k)) {
											currentEvent.description = line.substr('DESCRIPTION:'.length)
										}
									} else
										if (line.startsWith('TRANSP:') || line.startsWith('LAST-MODIFIED:')
											|| line.match(/^[A-Z\-]+\:/)) {
											insideDescription = false
											insideSummary = false
										} else
											if (insideDescription) {
												currentEvent.description += line
											} else
												if (insideSummary) {
													currentEvent.summary += line
												}
		})

	})

	return calendarList
}



module.exports = {
	searchCalendar,
	listCalendar
}

