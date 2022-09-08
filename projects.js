
// TODO: collect stats from github like the color bar but more accurate for local work

// TODO: list open windows and update using master-server design.
const path = require('path')
const fs = require('fs')
const {spawnSync} = require('child_process')
const d3Heatmap = require('./heatmap.js')

function workingEvents(path) {
  const WRITING_RATE = 100 // words per minute

  // TODO: use a combination of git commands to detect when work is done
  let datesOut = spawnSync('git', ['log', '--pretty=format:\'%ci\'', '--author="megamindbrian"'], {
    stdio: 'pipe',
    cwd: path,
    shell: true,
  })
  let fileDates = datesOut.stdout.toString('utf-8').trim().split('\n')
  if(!fileDates || fileDates.length == 0 || fileDates[0].length == 0) {
    return []
  }
  console.log(fileDates.length, ' commits in ', path)
  // git log -1 --pretty="format:%ci" ./utilities.js
  // git ls-tree --name-only -r @{18}
  let workingHours = {}
  let revision = 1
  while (revision <= fileDates.length) {
    /* let filesOut = spawnSync('git', ['ls-tree', '--name-only', '-r', '@{' + revision + '}'], {
      stdio: 'pipe'
    }) */
    // simple word count from commit diffs
    let filesOut = spawnSync('git', ['diff', `HEAD~${revision}..HEAD~${revision + 1}`], {
      stdio: 'pipe',
      cwd: path,
      shell: true,
    })
    if(filesOut.stderr.toString('utf-8').includes('fatal: log')
      || filesOut.stderr.toString('utf-8').includes('unknown revision')) {
      break
    }
    let fileList = filesOut.stdout.toString('utf-8').trim().split(/\w+/gi)
    /* for(let i = 0; i < fileList.length; i++) {
      let fileDate = spawnSync('git', ['log', '-1', '--pretty="%cd"', fileList[i]], {
        stdio: 'pipe'
      })
      let date = new Date(fileDate.stdout.toString('utf-8').trim())
      console.log(date)
    } */
    let day = Math.floor(new Date(fileDates[revision-1]).getTime() / 1000 / 60 / 60) * 1000 * 60 * 60
    if(typeof workingHours[day] == 'undefined') {
      workingHours[day] = 0
    }
    workingHours[day] += fileList.length / WRITING_RATE / 60

    revision++
  }

  return Object.keys(workingHours).map((key, i) => {
    let hours = workingHours[key]
    if(hours > 3) {
      hours = 3
    }
    let start = parseInt(key)
    let end = parseInt(key) + 60 * 1000 * hours
    return {
      id: i,
      start: new Date(start),
      end: new Date(end),
    }
  })
}


function projectHeatmap(path) {
  let events = workingEvents(path)
  if(events.length == 0) {
    return ''
  }
  let heatmap = d3Heatmap(events)
  return heatmap
}


const PROJECT_DIRS = {
  'Live Resume': __dirname,
  'Quake3e': path.join(__dirname, '/../Quake3e'), // i guess it doesn't really matter if history is recorded correctly
  'Elastic Game Server': path.join(__dirname, '/../elastic-game-server'),
  'Morpheus Consulting': path.join(__dirname, '/../morpheus'),
  'Study Sauce': '/Volumes/External-Bakup/Personal/Projects/studysauce3',

}


function listProjects() {
  return Object.keys(PROJECT_DIRS).map(name => {
    if(!fs.existsSync(PROJECT_DIRS[name])) {
      return ''
    }
    return `
<h3>${name}</h3>
${projectHeatmap(PROJECT_DIRS[name])}
`
  }).join('\n')
}

module.exports = {
  workingEvents,
  projectHeatmap,
  listProjects,
}



