const processData = (data) => {
  const today = new Date().toISOString().substr(0, 10);
  const x = data
    .filter((x) => x.dateDue >= today && x.dateDue.length === 10)
    .sort((a, b) => a.dateDue - b.dateDue);
  if (!x || x.length === 0) return [];
  const rtn = [x[0].frequency];
  let nextDate = x[0].dateDue;
  let i = 1;
  const lastDate = x[x.length - 1].dateDue;
  while (nextDate !== lastDate) {
    const currentDate = new Date(nextDate + 'T03:00:00');
    currentDate.setDate(currentDate.getDate() + 1);
    nextDate = currentDate.toISOString().substr(0, 10);
    if (x[i].dateDue === nextDate) {
      rtn.push(x[i].frequency);
      i++;
    } else {
      rtn.push(0);
    }
  }
  return rtn;
};

const getIntervalChart = (canvas = document.createElement('canvas'), data, width, height) => {
  canvas.width = width;
  canvas.height = height;

  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 128, 64, 1)';

  const highest = Math.max(...data);

  for (let i = 0; i < data.length; i++) {
    ctx.fillRect(
      0 + (i * width) / data.length,
      height * (1 - data[i] / highest),
      width / data.length,
      (height * data[i]) / highest
    );
  }

  return canvas;
};

const getBarChart = (data) => {
  var canvas = document.createElement('canvas');

  canvas.width = 100;
  canvas.height = 20;

  const processedData = processData(data);
  const displayNumber = 20;

  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';

  for (let i = 0; i < Math.min(displayNumber, processedData.length); i++) {
    ctx.fillRect(
      0 + (i * 100) / displayNumber,
      20 - Math.min(20, (20 * processedData[i]) / 50),
      100 / displayNumber,
      Math.min(20, (20 * processedData[i]) / 50)
    );
  }

  return canvas;
};

export { getBarChart, getIntervalChart };
