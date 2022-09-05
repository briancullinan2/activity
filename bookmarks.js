
const fs = require('fs')
const path = require('path')
const JSONStream = require('JSONStream')
const {Readable} = require('stream')
const {decryptFile, chromeDtToDate} = require('./utilities.js')


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

    workingPaths.push(path.join(settingsPath, 'BraveSoftware\/Brave-Browser\/Default\/Bookmarks'))
    workingPaths.push(path.join(settingsPath, 'Google\/Chrome\/Default/Bookmarks'))
    
    for(let i = 0; i < workingPaths.length; i++) {
        if(fs.existsSync(workingPaths[i])) {
            return workingPaths[i]
        }
    }
}


function decryptBookmarks() {
    const bookmarksFile = findBookmarksFile()
    const bookmarksData = fs.readFileSync(bookmarksFile).toString('utf-8')
    let decryptedBookmarks
    if(bookmarksData[0] == '{') {
        decryptedBookmarks = bookmarksData
    } else {
        decryptedBookmarks = decryptFile(bookmarksData)
    }
    
    return decryptedBookmarks
}

function recursiveGroup(root, obj, book) {
    if(typeof book.children != 'undefined') {
        let groupName = book.name
        let recursiveFunc = recursiveGroup.bind(null, (root.includes('Other Bookmarks') ? '' : (root + '/')) + book.name)
        let children = book.children.reduce(recursiveFunc, {})
        if(typeof obj[groupName] == 'undefined') {
            obj[groupName] = {}
        }
        Object.assign( obj[groupName], children)
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
        if(typeof obj.folder != 'undefined') {
            list.push(obj)
        } else {
            let children = Object.values(obj).reduce(flatten, [])
            for(let i = 0; i < children.length; i++) {
                list.push(children[i])
            }
        }
        return list
    }, [])

    return flattened
}

// TODO: make an html page out of categories
function outputBookmarks() {
    let bookmarks = parseBookmarks()
    let recentlyAdded = bookmarks.filter(book => book.date.getTime() > Date.now() - 24 * 60 * 60 * 1000)
    console.log(recentlyAdded)
}

// TODO: commit to a seperate branch using GitHub Actions CI

module.exports = {
    outputBookmarks
}