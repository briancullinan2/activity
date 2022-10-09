
// TODO: share some thoughts from calendar recordings, maybe a color/emotion or a new calendar for software ideas
let assert = require('assert');
let util = require('util');

let calendarList = [], lastCalendar;

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
	if(calendarList.length == 0) {
		let calendar = authorize()
		r = util.promisify(calendar.calendarList.list.bind(calendar))()
	} else {
		r = calendarList
	}
	calendarList = (r.data || {}).items || []
	return await filterCalendar(options)
}

// TODO: definitely share brainstorming sessions

function searchCalendar(search, calendar) {
	if (calendar) {
		options.calendarId = calendar;
	}
	let total = 0;
	return getOauthClient(options)
		.then(() => correctCalendarId(options))
		.then(() => importer.runAllPromises(search.split('|').map(term => resolve => {
			return listEvents({
				auth: options.auth,
				calendarId: options.calendarId,
				q: term
			}).then(r => {
				console.log(term);
				console.log(r.map(e => e.event.summary).slice(0, 10));
				return resolve(r);
			})
		})))
}
// TODO: scan events from .ical calendar export type



