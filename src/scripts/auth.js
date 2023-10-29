/* global gapi */
import { showHomePage } from '../components/home';

// Client ID and API key from the Developer Console
var CLIENT_ID = document
  .querySelector('meta[name=google-signin-client_id]')
  .getAttribute('content');
var API_KEY = document
  .querySelector('meta[name=google-drive-api-key]')
  .getAttribute('content');

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES =
  'https://www.googleapis.com/auth/drive.appdata openid email profile';

var access_token;

function initOauthFlow() {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=${SCOPES}&prompt=consent&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrough_value&redirect_uri=${window.origin}/key&client_id=${CLIENT_ID}`;
  window.location.href = url;
}

function getAccessToken() {
  fetch('/token')
    .then((x) => x.json())
    .then((x) => {
      if (!x.access_token) {
        initOauthFlow();
      } else {
        access_token = x.access_token;
        if (gapi) {
          console.log('gapi loaded first, token now loaded');
          gapi.load('client', initClient);
        }
      }
    });
}

getAccessToken();

window.handleGapiLoaded = () => {
  if (access_token) {
    console.log('token loaded first, gapi now ready');
    gapi.load('client', initClient);
  }
};

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
async function initClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });

  gapi.client.setToken({ access_token });

  showHomePage(true);
}
