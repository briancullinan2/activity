
// TODO: collect stats from github like the color bar but more accurate for local work

// TODO: list open windows and update using master-server design.
const path = require('path')
const fs = require('fs')
const {spawnSync} = require('child_process')
const d3Heatmap = require('./heatmap.js')

function workingEvents(path) {
  const WRITING_RATE = 100 // words per minute
  // TODO: use a combination of git commands to detect when work is done
  let datesOut = spawnSync('git', ['log', '--pretty=format:\'%ci\''], {
    stdio: 'pipe',
    // TODO: cwd: path
  })
  let fileDates = datesOut.stdout.toString('utf-8').trim().split('\n')

  // git log -1 --pretty="format:%ci" ./utilities.js
  // git ls-tree --name-only -r @{18}
  let workingHours = {}
  let revision = 1
  while (true) {
    /* let filesOut = spawnSync('git', ['ls-tree', '--name-only', '-r', '@{' + revision + '}'], {
      stdio: 'pipe'
    }) */
    // simple word count from commit diffs
    let filesOut = spawnSync('git', ['diff', `HEAD~${revision}..HEAD~${revision + 1}`], {
      stdio: 'pipe'
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
    let start = parseInt(key)
    let end = parseInt(key) + 60 * 1000 * workingHours[key]
    return {
      id: i,
      start: new Date(start),
      end: new Date(end),
    }
  })
}


function projectHeatmap(path) {
  let events = workingEvents()
  let heatmap = d3Heatmap(events)
  return heatmap
}


module.exports = {
  workingEvents,
  projectHeatmap,
}



