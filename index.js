const fs = require('fs')

const { listBookmarks } = require('./bookmarks.js')
const { listWindows } = require('./windows.js')
const { listHistory } = require('./history.js')

const INDEX = fs.readFileSync('./index.html').toString('utf-8')

function renderIndex() {

	let bodyTag = INDEX.match(/<ol class="categories"[\n\r.^>]*?>/i)
	let offset = bodyTag.index
	let index = INDEX.substring(0, offset)
		+ listBookmarks() + INDEX.substring(offset + bodyTag[0].length, INDEX.length)
	
	bodyTag = index.match(/<ol class="windows"[\n\r.^>]*?>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listWindows() + index.substring(offset + bodyTag[0].length, index.length)
		
	bodyTag = index.match(/vis.DataSet\(\[\]\)/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ `vis.DataSet(${listHistory()})` + index.substring(offset + bodyTag[0].length, index.length)

	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

