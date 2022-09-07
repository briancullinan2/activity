const fs = require('fs')

const { listBookmarks } = require('./bookmarks.js')
const { listWindows } = require('./windows.js')

const INDEX = fs.readFileSync('./index.html').toString('utf-8')

function renderIndex() {

	let bodyTag = INDEX.match(/<ol class="categories"[\n\r.^>]*?>/i)
	let offset = bodyTag.index // + bodyTag[0].length
	let index = INDEX.substring(0, offset)
		+ listBookmarks() + INDEX.substring(offset, INDEX.length)
	bodyTag = INDEX.match(/<ol class="windows"[\n\r.^>]*?>/i)
	offset = bodyTag.index // + bodyTag[0].length
	index = index.substring(0, offset)
		+ listWindows() + index.substring(offset, index.length)

	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

