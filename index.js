const fs = require('fs')
const path = require('path')

const { listBookmarks } = require('./bookmarks.js')
const { listWindows } = require('./windows.js')
const { listHistory } = require('./history.js')
const { listProjects } = require('./projects.js')
const { listCalendar } = require('./calendar.js')

const INDEX = fs.readFileSync('./index.html').toString('utf-8')
const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const TXT2IMG = path.join(HOMEPATH, 'stable-diffusion-webui/outputs/txt2img-images')


async function renderIndex() {
	let index = INDEX

	let bodyTag = index.match(/<ol class="heatmaps"[\n\r.^>]*?>/i)
	let offset = bodyTag.index
	index = index.substring(0, offset)
		+ listProjects(false) + index.substring(offset + bodyTag[0].length, index.length)

	bodyTag = index.match(/<ol class="heatmaps2"[\n\r.^>]*?>/i)
	offset = bodyTag.index
	index = index.substring(0, offset)
		+ listProjects(true /* past projects */) + index.substring(offset + bodyTag[0].length, index.length)
	
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
		.flat(1)
		.filter(a => a.start)
		.sort((a, b) => b.start.getTime() - a.start.getTime())
		.slice(0, 1000)

	let currYear2
	let calendarStr = ''
	for(let i = 0; i < listAllEvents.length; i++) {
		let item = listAllEvents[i]
		let yearStr = ''
		if(!item.start) {
			continue
		}
		if(item.start.getFullYear() !== currYear2) {
			currYear2 = item.start.getFullYear()
			yearStr = `<div class="history-item"><h3 class="time">${item.start.getFullYear()}</h3></div>`
		}
		calendarStr += `${yearStr}<div class="history-item ${item.name}"><span class="time">${item.start.getMonth() + 1}/${item.start.getDate()} ${item.start.getHours() % 12}:${item.start.getMinutes() < 10 ? '0' : ''}${item.start.getMinutes()} ${item.start.getHours() >= 12 ? 'pm' : 'am'}</span><span class="content">${item.content}</span></div>\n`
	}

	bodyTag = index.match(/<h2>Daily Activity<\/h2>/i)
	offset = bodyTag.index + bodyTag[0].length
	index = index.substring(0, offset) + calendarStr
		+ index.substring(offset, index.length)


/*
	let directories = fs.readdirSync(TXT2IMG)
	console.log(directories)
	let iframes = ''
	for(let i = 0; i < directories.length; i++) {
		if (directories[i][0] == '.') continue
		if (!fs.statSync(path.join(TXT2IMG, directories[i])).isDirectory()) continue
		if(directories[i].includes('urpm') || directories[i].includes('naked') || directories[i].includes('x-rated') || directories[i].includes('nsfw')) continue
		let imageFiles = fs.readdirSync(path.join(TXT2IMG, directories[i])).filter(i => i.includes('.png'))
		let count = 0
		let images = ''
		let pages = ''
		let radios = ''
		let directoryTokens = directories[i].toLocaleLowerCase().replace(/\s2$/, ' two').split(/[^a-z0-9]/gi).sort().filter((a, i, arr) => arr.indexOf(a) == i).join(' ')
		iframes += '<li class="' + directoryTokens + '"><iframe src="./clipart/' + encodeURIComponent(directories[i]) + '.html"></iframe></li>'

		for(let j = 0; j < imageFiles.length; j++) {
			if (imageFiles[j][0] == '.') continue
			if (!fs.statSync(path.join(TXT2IMG, directories[i], imageFiles[j])).isFile()) continue
			//count++
			let uniqueTokens = (directories[i] + ' ' + imageFiles[j]).toLocaleLowerCase().replace(/\s2$/, ' two').split(/[^a-z0-9]/gi).sort().filter((a, i, arr) => arr.indexOf(a) == i).join(' ')
			images += '<li class="' + uniqueTokens + '" style="background-image:url(https://raw.githubusercontent.com/briancullinan2/clipart/main/' + encodeURIComponent(directories[i]).replace(/\(/gi, '%28').replace(/\)/gi, '%29') + '/' + encodeURIComponent(imageFiles[j]).replace(/\(/gi, '%28').replace(/\)/gi, '%29') + '?raw=true)"><a href="https://raw.githubusercontent.com/briancullinan2/clipart/main/' + encodeURIComponent(directories[i]).replace(/\(/gi, '%28').replace(/\)/gi, '%29') + '/' + encodeURIComponent(imageFiles[j]).replace(/\(/gi, '%28').replace(/\)/gi, '%29') + '?raw=true"> </a></li>'
			//if(count == 6) break
		}
		for(let j = 1; j <= Math.ceil(imageFiles.length / 6); j++) {
			radios += '<input type="radio" id="clip-page' + j + '" name="page" value="0" ' + (j == 1 ? 'checked="checked"' : '') + ' />'
			pages += '<li class="tens-' + Math.floor(j / 10) + '"><a href="#clip-page' + j + '"><label for="clip-page' + j + '">' + j + '</label></a></li>'
		}
		fs.writeFileSync(path.join(__dirname, 'docs/clipart/' + directories[i] + '.html'), '<html class="iframe"><head>' +
			'<link rel="stylesheet" href="../resume.css">'
			+ '</head><body>' + radios + '<h3>Pages</h3><ol class="pages">' + pages + '</ol><ul class="clipart">' + images + '</ul></body>')
	}

	bodyTag = index.match(/<ul class="clipart">/i)
	offset = bodyTag.index + bodyTag[0].length
	index = index.substring(0, offset) + iframes
		+ index.substring(offset, index.length)
*/

	fs.writeFileSync(path.join(__dirname, 'docs/index.html'), index)
}



module.exports = {
	listBookmarks,
	listWindows,
	renderIndex
}

