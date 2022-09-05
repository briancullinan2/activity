// this is mostly unnecessary since i publish a lot without care, 
//   but if someone else wanted to only list a portion of their bookmarks
//   the option is there to prevent snooping on everything

// this is a workflow thing, a minimal example
const fs = require('fs')
const path = require('path')

const HOMEPATH = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
const PASSWORD = process.env.ENCRYPTION_SALT 
    || fs.readFileSync(path.join(HOMEPATH, '.credentials\/bookmarks.txt'))

// SOURCE: https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption

function crypt (salt, text) {
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const byteHex = (n) => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code)
  
    return text
      .split("")
      .map(textToChars)
      .map(applySaltToChar)
      .map(byteHex)
      .join("");
}
  
function decrypt (salt, encoded) {
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code)
    return encoded
      .match(/.{1,2}/g)
      .map((hex) => parseInt(hex, 16))
      .map(applySaltToChar)
      .map((charCode) => String.fromCharCode(charCode))
      .join("");
}

// TODO: encrypt a file
function encryptFile(file) {
    return crypt(PASSWORD, file)
}

// TODO: decrypt a file
function decryptFile(file) {
    return decrypt(PASSWORD, file)
}

function chromeDtToDate(st_dt) {
    var microseconds = parseInt(st_dt, 10);
    var millis = microseconds / 1000;
    var past = new Date(1601, 0, 1).getTime();
    return new Date(past + millis);
}

module.exports = {
    decryptFile,
    encryptFile,
    chromeDtToDate,
}