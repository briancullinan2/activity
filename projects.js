
// TODO: collect stats from github like the color bar but more accurate for local work

// TODO: list open windows and update using master-server design.
const process = require('process')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')
const d3Heatmap = require('./heatmap.js')

function workingEvents(path, past = false) {
  const WRITING_RATE = 100 // words per minute
  const CURRENT_YEAR = (new Date).getFullYear()

  // TODO: use a combination of git commands to detect when work is done
  let datesOut = spawnSync('git', ['log', '--all', '--pretty=format:\'%ci\'', '--author="megamindbrian"'], {
    stdio: 'pipe',
    cwd: path,
    shell: true,
  })
  let fileDates = datesOut.stdout.toString('utf-8').trim().split('\n')
  if (!fileDates || fileDates.length == 0 || fileDates[0].length == 0) {
    return []
  }
  console.log(fileDates.length, ' commits in ', path)
  // git log -1 --pretty="format:%ci" ./utilities.js
  // git ls-tree --name-only -r @{18}
  let workingHours = {}
  let revision = 1
  while (revision <= Math.min(fileDates.length, 1000)) {
    /* let filesOut = spawnSync('git', ['ls-tree', '--name-only', '-r', '@{' + revision + '}'], {
      stdio: 'pipe'
    }) */
    // simple word count from commit diffs
    let parsedDate = new Date(fileDates[revision - 1])
    /* if (!past && parsedDate.getFullYear() != CURRENT_YEAR) {
      revision++
      continue
    } else 
    // i guess it doesn't really matter if history is recorded correctly
    if (past) {
      parsedDate = new Date(parsedDate.getMonth() + '/' + parsedDate.getDate() + '/' + CURRENT_YEAR)
    } */

    let filesOut = spawnSync('git', ['diff-tree', `HEAD~${revision}..HEAD~${revision + 1}`], {
      stdio: 'pipe',
      cwd: path,
      shell: true,
    })
    if (filesOut.stderr.toString('utf-8').includes('fatal: log')
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
    let day = Math.floor(parsedDate.getTime() / 1000 / 60 / 60) * 1000 * 60 * 60
    if (typeof workingHours[day] == 'undefined') {
      workingHours[day] = 0
    }
    workingHours[day] += fileList.length / WRITING_RATE / 60

    revision++
  }

  return Object.keys(workingHours).map((key, i) => {
    let hours = workingHours[key]
    if (hours > 3) {
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

let allEvents = []


function projectHeatmap(path, past = false) {
  let events = workingEvents(path, past)
  allEvents = allEvents.concat(events)
  if (events.length == 0) {
    return ''
  }
  let heatmap = d3Heatmap(events)
  return heatmap
}


const PROJECT_DIRS = {
  'Live Resume': __dirname,
  'Jupyter Ops': path.join(__dirname, '/../jupyter_ops'),
  'Multigame': path.join(__dirname, '/../multigame'),
  'Quake3e': path.join(__dirname, '/../Quake3e'), 
}

const PAST_PROJECT_DIRS = {
  //'Current Activity': path.join(__dirname, '/../activity'),
  'Elastic Game Server': path.join(__dirname, '/../elastic-game-server'),
  'Morpheus Consulting': path.join(__dirname, '/../morpheus'),
  'Planet Quake': path.join(__dirname, '/../planet_quake'),
  'Study Sauce': path.join(__dirname, '/../studysauce3'),
}


function listProjects(past = false) {
  let projects = Object.keys(past ? PAST_PROJECT_DIRS : PROJECT_DIRS).map(name => {
    if (!fs.existsSync(past ? PAST_PROJECT_DIRS[name] : PROJECT_DIRS[name])) {
      return ''
    }
    let svgOutput = path.join(__dirname, '/docs/' + name + '.svg')
    if(!fs.existsSync(svgOutput)) {
      let svgData = projectHeatmap(past ? PAST_PROJECT_DIRS[name] : PROJECT_DIRS[name], past)
      fs.writeFileSync(svgOutput, svgData)
    }
    return `<h3>${name}</h3><img src="${name}.svg" />`
  }).join('\n')
  let svgOutput = path.join(__dirname, '/docs/ALL.svg')
  if(allEvents && !fs.existsSync(svgOutput)) {
    let svgData = d3Heatmap(allEvents)
    fs.writeFileSync(svgOutput, svgData)
  }
  return past ? `<h3>All of Time</h3><img src="ALL.svg" />${projects}` : projects
}

module.exports = {
  workingEvents,
  projectHeatmap,
  listProjects,
}



