import {
  sessionStart,
  jsonResponse,
  getRefreshTokenFromDb,
  refreshAccessToken,
} from '../src/fn/utils';

export async function onRequest(context) {
  const isNewSession = sessionStart(context);

  if (isNewSession) {
    console.log('Cookie not set');
    const resp = await jsonResponse({ access_token: false, no_cookie: true });
    return resp;
  }
  console.log('cookie set lets try the db for the refresh token');
  const refreshToken = await getRefreshTokenFromDb();
  if (refreshToken) {
    console.log('>>>>> use the refresh token');
    const access_token = await refreshAccessToken(refreshToken);
    if (access_token) {
      console.log('>>>>> access token found and returned');
      const resp = await jsonResponse({ access_token, token_refreshed: true });
      return resp;
    } else {
      console.log(
        '>>>>> no access token - perhaps access revoked at some point'
      );
      const resp = await jsonResponse(
        {
          access_token: false,
          token_refresh_failed: true,
        },
        true
      );
      return resp;
    }
  } else {
    console.log('>>>>> no refresh token found');
    // no refresh token so let's ditch the cookie
    const resp = await jsonResponse(
      {
        access_token: false,
        no_refresh_token: true,
      },
      true
    );
    return resp;
  }
}
