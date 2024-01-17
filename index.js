const fs = require('fs')

const { listBookmarks } = require('./bookmarks.js')
const { listWindows } = require('./windows.js')
const { listHistory } = require('./history.js')
const { listProjects } = require('./projects.js')
const { listCalendar } = require('./calendar.js')

const INDEX = fs.readFileSync('./index.html').toString('utf-8')

async function renderIndex() {
	let index = INDEX

	let bodyTag = index.match(/<ol class="heatmaps"[\n\r.^>]*?>/i)
	let offset = bodyTag.index
	index = index.substring(0, offset)
		+ listProjects() + index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<ol class="categories"[\n\r.^>]*?>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listBookmarks() + index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<ol class="windows"[\n\r.^>]*?>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listWindows() + index.substring(offset + bodyTag[0].length, index.length)

	let history = await listHistory()
	let currYear
	let historyStr = history
		.sort((a, b) => a.start - b.start)
		.map(item => {
			let yearStr = ''
			if(item.start.getFullYear() !== currYear) {
				currYear = item.start.getFullYear()
				yearStr = `<div class="history-item"><h3 class="time">${item.start.getFullYear()}</h3></div>`
			}
			return `${yearStr}<div class="history-item"><span class="time">${item.start.getMonth() + 1}/${item.start.getDate()} ${item.start.getHours() % 12}:${item.start.getMinutes() < 10 ? '0' : ''}${item.start.getMinutes()} ${item.start.getHours() >= 12 ? 'pm' : 'am'}</span><span class="content">${item.content}</span></div>`
		}).join('\n')
	bodyTag = index.match(/<h2>Browsing Activity<\/h2>/i)
	offset = bodyTag.index + bodyTag[0].length
	index = index.substring(0, offset) + historyStr 
		+ index.substring(offset, index.length)



	let calendarEntries = await listCalendar()
	/*
	let groups = Object.keys(calendarEntries).map((k, i) => {
		return { id: i, content: k }
	})
	let listAllEvents = Object.values(calendarEntries)
		.map(arr => {
			arr.sort((a, b) => b.start - a.start)
			return arr.slice(0, 20)
		}).flat(1)
	*/

	let listAllEvents = Object.values(calendarEntries)
		.map(arr => {
			arr.sort((a, b) => b.start - a.start)
			return arr.slice(0, 30)
		})
		.flat(1)
		.sort((a, b) => a.start - b.start)
		
	let currYear2
	let calendarStr = listAllEvents.map(item => {
		let yearStr = ''
		if(!item.start) {
			return ''
		}
		if(item.start.getFullYear() !== currYear2) {
			currYear2 = item.start.getFullYear()
			yearStr = `<div class="history-item"><h3 class="time">${item.start.getFullYear()}</h3></div>`
		}
		return `${yearStr}<div class="history-item"><span class="time">${item.start.getMonth() + 1}/${item.start.getDate()} ${item.start.getHours() % 12}:${item.start.getMinutes() < 10 ? '0' : ''}${item.start.getMinutes()} ${item.start.getHours() >= 12 ? 'pm' : 'am'}</span><span class="content">${item.content}</span></div>`
	}).join('\n')

	bodyTag = index.match(/<h2>Daily Activity<\/h2>/i)
	offset = bodyTag.index + bodyTag[0].length
	index = index.substring(0, offset) + calendarStr
		+ index.substring(offset, index.length)


	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

