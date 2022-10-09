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

	bodyTag = index.match(/items = new vis.DataSet\(\[\]\)/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ `items = new vis.DataSet(${listHistory()})` + index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/items2 = new vis.DataSet\(\[\]\)/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ `items2 = new vis.DataSet(${await listCalendar()})` + index.substring(offset + bodyTag[0].length, index.length)
	
	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

