/* global gapi */

async function listFiles() {
  const { result } = await gapi.client.drive.files.list({
    spaces: 'appDataFolder',
  });

  return result.files;
}

async function createFile(name) {
  const r = await gapi.client.drive.files.create({
    resource: {
      name,
      parents: ['appDataFolder'],
    },
    fields: 'id',
  });

  return r.result.id;
}

async function saveAppData(fileId, appData) {
  await gapi.client.request({
    path: '/upload/drive/v3/files/' + fileId,
    method: 'PATCH',
    params: {
      uploadType: 'media',
    },
    body: JSON.stringify(appData),
  });
}

async function getFile(fileId) {
  const data = await gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  });
  return data.result;
}

// Get file id from name, creating file if not exists
async function getFileIdFromName(name) {
  const files = await listFiles();
  const file = files.filter((x) => x.name === name)[0];
  const fileId = file ? await Promise.resolve(file.id) : await createFile(name);
  return fileId;
}

async function getDriveLists() {
  const fileId = await getFileIdFromName('lists.json');
  const file = await getFile(fileId);
  return file || [];
}

async function addListsToDrive(list) {
  const fileId = await getFileIdFromName('lists.json');
  await saveAppData(fileId, list);
}

async function getDriveWords() {
  const fileId = await getFileIdFromName('words.json');
  const file = await getFile(fileId);
  return file
    ? file.map((x) => {
        x.n = new Date(x.n);
        return x;
      })
    : [];
}

async function addWordsToDrive(words) {
  const fileId = await getFileIdFromName('words.json');
  await saveAppData(fileId, words);
}

async function getDriveTimestamp() {
  const fileId = await getFileIdFromName('timestamp.txt');
  const file = await getFile(fileId);
  return file || false;
}

async function setDriveTimestamp(timestamp) {
  const fileId = await getFileIdFromName('timestamp.txt');
  await saveAppData(fileId, timestamp);
}

async function pushAllToDrive(words, lists, timestamp) {
  await Promise.all([addWordsToDrive(words), addListsToDrive(lists)]);
  await setDriveTimestamp(timestamp);
}

async function getDriveStuff() {
  const [words, lists, timestamp] = await Promise.all([
    getDriveWords(),
    getDriveLists(),
    getDriveTimestamp(),
  ]);
  return { words, lists, timestamp };
}

export {
  getDriveLists,
  addListsToDrive,
  getDriveWords,
  getDriveTimestamp,
  addWordsToDrive,
  pushAllToDrive,
  getDriveStuff,
};
