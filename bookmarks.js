const fs = require('fs')
const path = require('path')
const os = require('os') // Imported missing os module
const { decryptFile, chromeDtToDate } = require('./utilities.js')

// TODO: import from bookmarks.html or from database, copy code from jupyter_ops

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

function findBookmarksFile() {
	let workingPaths = []
	let settingsPath

	if (os.platform() === 'win32') { // Fixed method execution syntax error
		settingsPath = path.join(HOMEPATH, 'AppData/Local')
	} else {
		if (os.platform() === 'darwin') {
			settingsPath = path.join(HOMEPATH, 'Library/Application Support')
		} else {
			settingsPath = path.join(HOMEPATH, '.config')
		}
	}

	workingPaths.push(path.join(settingsPath, 'Google/Chrome/Default/Bookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/Profile 1/Bookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/User Data/Default/Bookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/User Data/Profile 1/Bookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/User Data/Default/AccountBookmarks'))
	workingPaths.push(path.join(settingsPath, 'Google/Chrome/User Data/Profile 1/AccountBookmarks'))
	workingPaths.push(path.join(settingsPath, 'BraveSoftware/Brave-Browser/Default/Bookmarks'))

	for (let i = 0; i < workingPaths.length; i++) {
		if (fs.existsSync(workingPaths[i])) {
			return workingPaths[i]
		}
	}
	console.log('Checked:\n' + workingPaths.join('\n'))
}

function decryptBookmarks() {
	const bookmarksFile = findBookmarksFile()
	if (!bookmarksFile) throw new Error('Couldn\'t locate bookmarks')
	const bookmarksData = fs.readFileSync(bookmarksFile).toString('utf-8')
	let decryptedBookmarks
	if (bookmarksData[0] == '{') {
		decryptedBookmarks = bookmarksData
	} else {
		decryptedBookmarks = decryptFile(bookmarksData)
	}

	return decryptedBookmarks
}

function parseBookmarks() {
	let decryptedBookmarks = JSON.parse(decryptBookmarks()).roots
	let root = decryptedBookmarks.bookmark_bar.children

	if (decryptedBookmarks.other && decryptedBookmarks.other.children) {
		root = root.concat(decryptedBookmarks.other.children)
	}
	if (decryptedBookmarks.synced && decryptedBookmarks.synced.children) {
		root = root.concat(decryptedBookmarks.synced.children)
	}

	let bookmarks = root.reduce((function recursiveGroup(root, list, book) {
		let folder = root
		if (folder.includes('Other Bookmarks')) {
			folder = ''
		}
		if (book.type == 'folder') {
			folder += (folder && folder.length > 0 ? '/' : '') + book.name
			if (book.children) {
				book.children.forEach(recursiveGroup.bind(null, folder, list))
			}
		} else {
			book.folder = folder
			book.time_usec = parseInt(book.date_added + '')
			book.date = chromeDtToDate(book.time_usec)
			list.push(book)
		}

		return list
	}).bind(null, ''), [])

	return bookmarks
}




function listBookmarks(startDate = null, endDate = null) {
	let bookmarks = parseBookmarks()

	// 1. Filter elements by date window parameters
	let filteredBookmarks = bookmarks.filter(book => {
		if (startDate && book.date < startDate) return false;
		if (endDate && book.date > endDate) return false;
		return true;
	});

	// 2. Sort chronologically (newest first)
	let recentlyAdded = filteredBookmarks.sort((a, b) => b.date - a.date);

	// 3. Slice the top 100 ONLY if both start and end dates are omitted
	if (!startDate && !endDate) {
		recentlyAdded = recentlyAdded.slice(0, 100);
	}

	let bookmarkFolders = recentlyAdded.map(book => book.folder).filter((f, i, arr) => arr.indexOf(f) == i)

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

	return {
		html: html,
		raw: recentlyAdded
	}
}

// ====================================================================
// CLI INTERFACE EXECUTION BLOCK
// ====================================================================
if (require.main === module) {
	(async () => {
		const getArg = (flag) => {
			const index = process.argv.indexOf(flag);
			return (index !== -1 && process.argv[index + 1]) ? process.argv[index + 1] : null;
		};

		const startStr = getArg('--start');
		const endStr = getArg('--end');

		let startDate = startStr ? new Date(startStr) : null;
		let endDate = endStr ? new Date(endStr) : null;

		if (startStr && isNaN(startDate.getTime())) {
			console.error(`Invalid start date format: "${startStr}". Use YYYY-MM-DD.`);
			process.exit(1);
		}
		if (endStr && isNaN(endDate.getTime())) {
			console.error(`Invalid end date format: "${endStr}". Use YYYY-MM-DD.`);
			process.exit(1);
		}

		try {
			console.log(`Querying bookmarks added: [${startDate ? startDate.toISOString() : 'Earliest'}] to [${endDate ? endDate.toISOString() : 'Latest'}]...`);
			const results = listBookmarks(startDate, endDate);

			if (results.raw.length === 0) {
				console.log("No bookmark records located inside that target date range.");
				return;
			}

			// Print pristine terminal stdout tracking logs
			results.raw.forEach(item => {
				const timestamp = item.date.toLocaleString();
				const folderPrefix = item.folder ? `[${item.folder}] ` : '';
				console.log(`[${timestamp}] ${folderPrefix}${item.name} -> ${item.url}`);
			});
		} catch (err) {
			console.error("Execution Error:", err.message);
			process.exit(1);
		}
	})();
}

module.exports = {
	listBookmarks
}