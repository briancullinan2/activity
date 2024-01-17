
// TODO: share some thoughts from calendar recordings, maybe a color/emotion or a new calendar for software ideas
const fs = require('fs')
const path = require('path')
const assert = require('assert');
const util = require('util');
const { google } = require('googleapis');
const { authorize } = require('./authorize.js')
const ical = require('node-ical');

let calendarList = [], lastCalendar;
const CALENDAR_NAMES = [
	'Diet', 'Emotions', 'General', 'Iga',
	'Predictions', 'Revelation', 'Robot do'
]
const PUBLIC_CALENDARS = [
	'Diet', 'General', 'Revelation', 'Robot do', 'Predictions'
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
				&& fs.existsSync(path.join(HOMEPATH, 'Downloads', dir, 'Calendar')) // /General.ics
		})
		.map(dir => path.join(HOMEPATH, 'Downloads', dir, 'Calendar'))
	takeouts.sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime)

	const calendarList = CALENDAR_NAMES.reduce((obj, key) => {
		obj[key] = []
		return obj
	}, {})

	let eventId = 1
	//
	console.log(takeouts[0])
	let calendarFiles = fs.readdirSync(takeouts[0])
		.filter(fname => {
			return CALENDAR_NAMES.filter(ical => fname.startsWith(ical)
				&& fname.endsWith('.ics')).length > 0
		})
    .map(fname => path.join(takeouts[0], fname))

	let calendarEvents = calendarFiles.map((fname, id) => {
		if (!fs.existsSync(fname)) {
			return
		}
		const events = ical.sync.parseFile(fname);
		let eventsList = []
		for (const event of Object.values(events)) {
			event.content = event.summary + '\n' + event.description
			eventsList[eventsList.length] = event
		}

		return eventsList

	})

	return calendarEvents
}



module.exports = {
	searchCalendar,
	listCalendar
}

