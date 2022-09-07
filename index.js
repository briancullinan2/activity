const fs = require('fs')

const { listBookmarks } = require('./bookmarks.js')
const { listWindows } = require('./windows.js')

const INDEX = fs.readFileSync('./index.html').toString('utf-8')

function renderIndex() {

	let bodyTag = INDEX.match(/<body[\n\r.^>]*?>/i)
	let offset = bodyTag.index + bodyTag[0].length
	let index = INDEX.substring(0, offset).replace('<ol class="categories"', `<ol class="categories"`)
		+ listBookmarks() + INDEX.substring(offset, INDEX.length)
	index = INDEX.substring(0, offset).replace('<ol class="windows"', `<ol class="windows"`)
		+ listWindows() + INDEX.substring(offset, INDEX.length)

	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

