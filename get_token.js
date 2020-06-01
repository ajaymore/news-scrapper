const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');
const credentials = require('./credentials.json');

const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://mail.google.com/',
];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});
console.log('Authorize this app by visiting this url:', authUrl);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question('Enter the code from that page here: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token', err);
    oAuth2Client.setCredentials(token);
    // Store the token to disk for later program executions
    return fs.writeFile(
      path.join(__dirname, 'token.json'),
      JSON.stringify(token),
      (err2) => {
        if (err2) return console.error(err2);
        return console.log('Token stored to ', './token.json');
      }
    );
  });
});
