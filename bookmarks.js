
const {decryptFile} = require('./utilities.js')


const fs = require('fs')
const path = require('path')
const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE


function findBookmarksFile () {
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

    workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/Default/Bookmarks'))
    workingPaths.push(path.join(settingsPath, 'BraveSoftware\/Brave-Browser\/Default\/Bookmarks'))
    
    for(let i = 0; i < workingPaths.length; i++) {
        if(fs.existsSync(workingPaths[i])) {
            return workingPaths[i]
        }
    }
}


// TODO: decrypt uploaded file

// TODO: parse bookmarks

// TODO: make an html page out of categories

// TODO: commit to a seperate branch using GitHub Actions CI

