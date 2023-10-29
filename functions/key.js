import {
  sessionStart,
  getParam,
  getUserInfoFromCode,
  redirectHomeResponse,
} from '../src/fn/utils';

export async function onRequest(context) {
  sessionStart(context);

  const code = getParam('code');

  let resp = await redirectHomeResponse();

  if (code) {
    await getUserInfoFromCode(code);
    resp = await redirectHomeResponse();
  }
  return resp;
}
