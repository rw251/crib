import { parse } from 'cookie';
import crypto from 'node:crypto';

let cookie;
const cookieName = 'cribmember';
function loadCookie() {
  cookie = cookie || parse(context.request.headers.get('Cookie') || '');
}

function getSessionIdFromCookie() {
  loadCookie();
  return cookie[cookieName];
}

function generateKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function jsonResponse(json) {
  const resp = new Response(JSON.stringify(json), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
  if (session && session.userId && sessionId) {
    await context.env.CRIB_KV.put(sessionId, JSON.stringify(session));
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const myCookie = `cribmember=${sessionId}; Expires=${inThirtyDays.toUTCString()}`;
    resp.headers.set('Set-Cookie', myCookie);
  }
  return resp;
}

let session;
let sessionId;
let context;
async function sessionStart(ctx) {
  context = ctx;
  const existingSessionId = getSessionIdFromCookie();
  sessionId = existingSessionId || generateKey();

  const sessionJSON = await context.env.CRIB_KV.get(sessionId);
  session = sessionJSON ? JSON.parse(sessionJSON) : {};

  let isNewSession = !existingSessionId;
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
  const { user_id, email, name, refresh_token } = dbResp || {};
  if (refresh_token) {
    session.userId = user_id;
    session.email = email;
    session.name = name;
    session.refresh_token = refresh_token;
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

  console.log('>>>>> get user ' + userId + ' from db');
  const dbResp = await context.env.CRIB_DB.prepare(
    'SELECT session_id FROM users WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  if (dbResp && dbResp.session_id) {
    await context.env.CRIB_KV.delete(sessionId);
    sessionId = dbResp.session_id;
  }

  await updateUser();
}

async function updateUser() {
  if (!sessionId || !session.userId) return;
  const sql = `
    INSERT INTO users (user_id, refresh_token, email, name, session_id)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(user_id)
    DO UPDATE SET
      refresh_token=excluded.refresh_token, email=excluded.email, 
      name=excluded.name, session_id=excluded.session_id`;

  const info = await context.env.CRIB_DB.prepare(sql)
    .bind(
      session.userId,
      session.refresh_token || null,
      session.email || null,
      session.name || null,
      sessionId
    )
    .run();
  return info.success;
}

async function redirectHomeResponse() {
  const resp = new Response(null, {
    status: 302,
  });
  if (session && session.userId && sessionId) {
    await context.env.CRIB_KV.put(sessionId, JSON.stringify(session));
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const myCookie = `cribmember=${sessionId}; Expires=${inThirtyDays.toUTCString()}`;
    resp.headers.set('Set-Cookie', myCookie);
  }
  resp.headers.set('Location', '/');
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
