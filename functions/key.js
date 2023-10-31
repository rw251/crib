import {
  sessionStart,
  getParam,
  getUserInfoFromCode,
  redirectHomeResponse,
} from '../src/fn/utils';

export async function onRequest(context) {
  sessionStart(context);

  const code = getParam('code');

  if (code) {
    await getUserInfoFromCode(code);
  }
  const resp = await redirectHomeResponse();
  return resp;
}
