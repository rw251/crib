import { parse } from 'cookie';
import crypto from 'node:crypto';

const COOKIE = 'cribmember';

function getSessionIdFromCookie() {
  const cookie = parse(context.request.headers.get('Cookie') || '');
  return cookie[COOKIE];
}

function generateKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function jsonResponse(json, removeCookie) {
  const resp = new Response(JSON.stringify(json), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'Set-Cookie': setCookie(removeCookie),
    },
  });
  return resp;
}

function setCookie(isRemove) {
  const expiryDate = new Date();
  if (isRemove) {
    expiryDate.setHours(0);
    session.expiry = expiryDate.toUTCString();
  } else if (!session.expiry) {
    expiryDate.setDate(expiryDate.getDate() + 30);
    session.expiry = expiryDate.toUTCString();
  }
  const myCookie = `${COOKIE}=${sessionId}; Expires=${session.expiry}`;
  return myCookie;
}

let session;
let sessionId;
let context;
function sessionStart(ctx) {
  context = ctx;
  const existingSessionId = getSessionIdFromCookie();
  sessionId = existingSessionId || generateKey();

  session = {};

  const isNewSession = !existingSessionId;
  return isNewSession;
}

function getParam(name) {
  const { searchParams } = new URL(context.request.url);
  return searchParams.get(name);
}

async function getRefreshTokenFromDb() {
  const dbResp = await context.env.CRIB_DB.prepare(
    'SELECT * FROM users WHERE session_id = ?'
  )
    .bind(sessionId)
    .first();
  const { user_id, email, name, refresh_token, expiry } = dbResp || {};
  if (refresh_token) {
    session.userId = user_id;
    session.email = email;
    session.name = name;
    session.refresh_token = refresh_token;
    session.expiry = expiry;
    checkExpiry();
    return refresh_token;
  }
  return false;
}

async function refreshAccessToken(refresh_token) {
  const body = {
    client_id: context.env.CLIENT_ID,
    client_secret: context.env.CLIENT_SECRET,
    refresh_token,
    grant_type: 'refresh_token',
  };
  const obj = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then((x) => x.json());
  const access_token = obj.access_token;
  if (access_token) {
    session.access_token = access_token;
    return access_token;
  }
  return false;
}

async function getUserInfoFromCode(code) {
  //The url you wish to send the POST request to
  const url = 'https://oauth2.googleapis.com/token';

  const { protocol, host } = new URL(context.request.url);

  //The data you want to send via POST
  const body = {
    client_id: context.env.CLIENT_ID,
    client_secret: context.env.CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: `${protocol}//${host}/key`,
  };

  const obj = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then((x) => x.json());

  const jwt = obj.id_token.split('.');
  const userinfo = JSON.parse(atob(jwt[1]), true);

  console.log(atob(jwt[1]));

  const userId = userinfo['sub'];
  const email = userinfo['email'];
  const name = userinfo['name'];
  const accessToken = obj.access_token;
  const refreshToken = obj.refresh_token || '';

  session.access_token = accessToken;
  session.name = name;
  session.userId = userId;
  session.email = email;
  session.refresh_token = refreshToken;

  const resp = await context.env.CRIB_DB.prepare(
    'SELECT session_id, expiry FROM users WHERE user_id = ?'
  )
    .bind(userId)
    .first();
  if (resp && resp.session_id) {
    sessionId = resp.session_id;
  }
  if (resp && resp.expiry) {
    session.expiry = resp.expiry;
  }

  checkExpiry();

  await updateUser();
}

function checkExpiry() {
  if (!session.expiry || new Date(session.expiry) < new Date()) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    session.expiry = expiryDate.toUTCString();
    sessionId = generateKey();
  }
}
async function updateUser() {
  if (!sessionId || !session.userId) return;
  const sql = `
    INSERT INTO users (user_id, refresh_token, email, name, session_id, expiry)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(user_id)
    DO UPDATE SET
      refresh_token=excluded.refresh_token, email=excluded.email, 
      name=excluded.name, session_id=excluded.session_id, expiry=excluded.expiry`;

  const info = await context.env.CRIB_DB.prepare(sql)
    .bind(
      session.userId,
      session.refresh_token || null,
      session.email || null,
      session.name || null,
      sessionId,
      session.expiry || null
    )
    .run();
  return info.success;
}

async function redirectHomeResponse() {
  const resp = new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': setCookie(),
    },
  });
  return resp;
}

export {
  sessionStart,
  jsonResponse,
  redirectHomeResponse,
  refreshAccessToken,
  getRefreshTokenFromDb,
  getUserInfoFromCode,
  getParam,
};
