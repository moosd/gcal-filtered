const fs = require('fs');
const readline = require('readline');
const moment = require('moment');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';
const ical = require('ical-generator');
const http = require('http');

var params=function(req){
  let q=req.url.split('?'),result={};
  if(q.length>=2){
      q[1].split('&').forEach((item)=>{
           try {
             result[item.split('=')[0]]=item.split('=')[1];
           } catch (e) {
             result[item.split('=')[0]]='';
           }
      })
  }
  return result;
}

http.createServer(function(req, res) {
    console.log(req)
    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      req.params = params(req);
      credentials = JSON.parse(content)
      if(req.params.auth){ //auth
        code = decodeURIComponent(req.params.auth)
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
           client_id, client_secret, redirect_uris[0]);
        oAuth2Client.getToken(code, (err, token) => {
          if (err) return console.error('Error retrieving access token', err);
          oAuth2Client.setCredentials(token);
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) console.error(err);
            console.log('Token stored to', TOKEN_PATH);
          });
          listEvents(oAuth2Client, res);
      });
    } else {
      // Authorize a client with credentials, then call the Google Calendar API.
      authorize(credentials, listEvents, res);
    }
  });
}).listen(process.env.PORT || 3000, '0.0.0.0', function() {
    console.log('Server running...');
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, res) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback, res);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, res);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback, res) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
res.setHeader('Content-Type', 'text/html')
  res.end('Authorize this app by visiting this url: <a href="' + authUrl + '">click here</a><br /><BR /><form action="/"><input name="auth"><input type="submit"></form>');
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, res) {
  const cal = ical({domain: 'soura.mooo.com', name: 'Lab meeting calendar'});
  const calendar = google.calendar({version: 'v3', auth});
  res.setHeader("Cache-Control", "max-age=7200, private, must-revalidate")
  calendar.events.list({
    calendarId: '3hv5vp12nbj6i7nl3mcb0me78o@group.calendar.google.com',
    timeMin: (new Date()).toISOString(),
    maxResults: 500,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res2) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res2.data.items;
    if (events.length) {
      for(let i = 0; i < events.length; i++) {
        let event = events[i]
        const start = event.start.dateTime || event.start.date;
        if(event.summary.includes("Megakaryocytes/Mouse Lab Mtg")) {
           cal.createEvent({
sequence: (i==0 ? 0 : moment().valueOf()),
    start: moment(event.start.dateTime),
    end: moment(event.end.dateTime),
    summary: event.summary,
    description: event.summary,
    location: event.location
           });
         }
      }
  cal.serve(res);

    } else {
      console.log('No upcoming events found.');
    }
  });

}
