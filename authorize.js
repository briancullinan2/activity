const readline = require('readline');
const process = require('process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { OAuth2Client } = require('google-auth-library');

// Load client secrets from a local file.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_DIR = path.join(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE || '', '.credentials');

let SECRET_PATH, credentials;
try {
	SECRET_PATH = path.join(TOKEN_DIR, 'client_secret.json');
	credentials = JSON.parse(fs.readFileSync(SECRET_PATH).toString());
} catch (e) {
	console.log(e);
}


function storeToken(token, tokenPath) {
	fs.writeFileSync(tokenPath, JSON.stringify(token, null, 4));
	console.log('Token stored to ' + tokenPath);
}

function receiveCode(code, oauth2Client, tokenPath) {
	return util.promisify(oauth2Client.getToken.bind(oauth2Client))(code)
		.then(token => {
			console.log('recieved token: ' + token.access_token);
			oauth2Client.setCredentials(token);
			storeToken(token, tokenPath);
			return oauth2Client;
		})
}

async function cliFallback(up, authUrl, oauth2Client, tokenPath) {
	if (up.message.includes('ECONNREFUSED')
		|| up.message.includes('find module')) {
		console.log('can\'t authenticate with selenium, waiting for user input.');
		console.log('Authorize this app by visiting this url:', authUrl);
		const interface = readline.createInterface(process.stdin, process.stdout);
		const code = await new Promise(resolve => interface.question(
			'Enter the code from that page here: ', resolve))
		interface.close();
		return receiveCode(code, oauth2Client, tokenPath)
	} else {
		throw up;
	}
}

async function renewToken(oauth2Client, scopes, tokenPath) {
	const authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: scopes
	})
	return cliFallback(up, authUrl, oauth2Client, tokenPath)
}

async function authorize(scopes = SCOPES) {
	const tokenPath = path.join(TOKEN_DIR, scopes.join('')
		.replace(/[^a-z]+/ig, '_') + '.json')
	const oauth2Client = new OAuth2Client(
		credentials.installed.client_id,
		credentials.installed.client_secret,
		credentials.installed.redirect_uris[0])

	try {
		// Check if we have previously stored a token.
		oauth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath)));
		await oauth2Client.getAccessToken()
		return oauth2Client
	} catch (up) {
		// if the token file isn't found start a new auth
		if (up.message == 'invalid_token'
			|| up.code === 'ENOENT') {
			return renewToken(oauth2Client, scopes, tokenPath);
		} else {
			throw up;
		}
	}
}

module.exports = {
	authorize
}
