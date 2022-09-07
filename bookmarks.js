
const fs = require('fs')
const path = require('path')
const JSONStream = require('JSONStream')
const { Readable } = require('stream')
const { decryptFile, chromeDtToDate } = require('./utilities.js')

// TODO: import from bookmarks.html or from database, copy code from jupyter_ops

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

function findBookmarksFile() {
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

	workingPaths.push(path.join(settingsPath, 'BraveSoftware\/Brave-Browser\/Default\/Bookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/Default/Bookmarks'))

	for (let i = 0; i < workingPaths.length; i++) {
		if (fs.existsSync(workingPaths[i])) {
			return workingPaths[i]
		}
	}
}


function decryptBookmarks() {
	const bookmarksFile = findBookmarksFile()
	const bookmarksData = fs.readFileSync(bookmarksFile).toString('utf-8')
	let decryptedBookmarks
	if (bookmarksData[0] == '{') {
		decryptedBookmarks = bookmarksData
	} else {
		decryptedBookmarks = decryptFile(bookmarksData)
	}

	return decryptedBookmarks
}

function recursiveGroup(root, obj, book) {
	if (typeof book.children != 'undefined') {
		let groupName = book.name
		let recursiveFunc = recursiveGroup.bind(null, (root.includes('Other Bookmarks') ? '' : (root + '/')) + book.name)
		let children = book.children.reduce(recursiveFunc, {})
		if (typeof obj[groupName] == 'undefined') {
			obj[groupName] = {}
		}
		Object.assign(obj[groupName], children)
	} else {
		book.folder = root
		book.time_usec = parseInt(book.date_added + ''),
			book.date = chromeDtToDate(book.time_usec)
		obj[book.guid] = book
	}
	return obj
}

function parseBookmarks() {
	let decryptedBookmarks = decryptBookmarks()
	let root = JSON.parse(decryptedBookmarks).roots.bookmark_bar.children
	let bookmarks = root.reduce(recursiveGroup.bind(null, ''), {})

	// from this verified structure, list newest additions
	let flattened = Object.values(bookmarks).reduce(function flatten(list, obj) {
		if (typeof obj.folder != 'undefined') {
			list.push(obj)
		} else {
			let children = Object.values(obj).reduce(flatten, [])
			for (let i = 0; i < children.length; i++) {
				list.push(children[i])
			}
		}
		return list
	}, [])

	return flattened
}

// TODO: make an html page out of categories
function listBookmarks() {
	let bookmarks = parseBookmarks()
	let recentlyAdded = bookmarks.filter(book => book.date.getTime() > Date.now() - 24 * 60 * 60 * 1000)
	let bookmarkFolders = recentlyAdded.map(book => book.folder).filter((f, i, arr) => arr.indexOf(f) == i)
	// TODO: a little bit of read-time estimation it looks like a factor of images + words / reading speed
	// SOURCE: https://www.startpage.com/do/search?q=how+long+does+it+take+to+read+an+article+github
	// 200 words per minute average
	// ^^^ road-block because of PDF integration



	// TODO: cache page to PDF like my bookmark downloader, wkhtml2pdf should be good enough
	// search existing bookmark collections of PDFs to reduce work

	// TODO: display HTML boxes with percent of workday spent reading other people's research, 
	//   versus implementation from github logging
	let html = `
<ol class="categories">
${bookmarkFolders.map(folder => {
		let category
		if (path.dirname(folder) == '.') {
			category = `<li><a href="#${path.basename(folder)}">
    <label for="cat-${path.basename(folder)}">
    ${path.basename(folder)}</a></label></li>`
		} else {
			category = `<li><a href="#${path.basename(folder)}">
    <label for="cat-${path.basename(folder)}">
    ${path.basename(path.dirname(folder))}/${path.basename(folder)}</a></label></li>`
		}
		return category
	}).join('\n')}
</ol>


${bookmarkFolders.map((folder, i) => {
		return `
<input type="radio" id="cat-${path.basename(folder)}" name="category" value="${i}" />
<ol class="bookmarks">
${recentlyAdded.filter(book => book.folder == folder).map(book => {
			return `<li><a href="${book.url}">${book.name}</a></li>`
		}).join('\n')}
</ol>
`}).join('\n')}`

	// next level share-point with employee monitoring integration?

	// ABCs of programming
	return html
}

// TODO: commit to a seperate branch using GitHub Actions CI

module.exports = {
	listBookmarks
}