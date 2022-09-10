// run window enumerator to get current list of windows to coincide with the live-dev

// TODO: update with master-server or cloud function design, maybe a filteres POST from my IP
//   and in memory storage until the page is requested by remote clients

// AAAHAAAAHAHAHAHAHAHAHAHHHHHHHHHHH!!!!!!!!!!!!!
// no worky >:|
// this is the kind of crap the government should sponsor for open-source, 
//   get this working so the eco-system can expand and use WebAssembly and napi 
//   interchangably, could do away with Electron completely if we had solid native window bindings

/*
var ffi = require('ffi')
var ref = require('ref')
var int = ref.types.int

var libprime = ffi.Library('./sog.dylib', {
	'enumWindows': [ int, [] ],
	'getTitle': [ int, [ int ] ]
})
*/

let { spawn, spawnSync } = require('child_process')

function getWindows() {
	let ps = spawnSync(path.resolve('./sog'), [], {
		stdio: 'pipe'
	}) // sync since it's native utility?
	//ps.stdout.on('data', (data) => {
	//  stdout += data.toString('utf-8')
	//})
	/*
	await new Promise((resolve, reject) => ps.on('close', function (errCode) {
		if(errCode)
			return reject()
		return resolve(stdout)
	}))
	*/
	const IGNORE_PROGRAMS = [
		'Window Server',
		'Macs Fan Control',
		'Control Center',
		'Spotlight',
		'Dock',
	]
	let windows = ps.stdout.toString('utf-8').trim().split('\n').map(window => window.split(/:\s/g))
	if(!windows || windows.length == 0 || windows[0][0].length == 0) {
		return []
	}

	windows.sort((a, b) => a[0] - b[0])
	let windowsNames = windows.map(win => win[1])
	let windowsFiltered = windows
		.filter((w, i, arr) => windowsNames.indexOf(w[1]) == i && IGNORE_PROGRAMS.indexOf(w[1]) == -1)
		.map(win => win[1].replace(/\.app$/gi, ''))
	if(windowsFiltered.length > 0) {
		windowsFiltered[0] = '*' + windowsFiltered[0]
	}
	windowsFiltered.sort((a, b) => (a.startsWith('*') ? a.substring(1) : a).localeCompare(
		- (b.startsWith('*') ? b.substring(1) : b), 'en', {sensitivity: 'base'}))
	return windowsFiltered
}

function listWindows() {
	let windowsFiltered = getWindows()
	let html = `
  <ol class="windows">
  ${windowsFiltered.map(window => {
		let category
		let active = window.startsWith('*')
		if(active) 
			window = window.substring(1)
		category = `<li class="${active ? 'active' : ''}"><a href="#${window}">
		<label for="win-${window}">${window}</a></label>
		</li>`
		return category
	}).join('\n')}
  </ol>`

	// TODO: something like show download link, or remotely switch to window like a cheap streaming remote desktop?

	// TODO: something like taking periodic snapshots and show a scrolling list of window states

	// TODO: calendar entries might be a slight vulnerability
  return html
}

module.exports = {
  getWindows,
  listWindows,

}
