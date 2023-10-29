import { hideAllPages, hideButtonBar } from '../scripts/utils';
import { getStats } from '../scripts/db';
import { publish } from '../scripts/pubsub';
import { getIntervalChart } from './barChart';

const statsPage = document.getElementById('statsPage');
const dueTable = document.getElementById('dueTable');
const canvas = document.getElementById('intervalChart');

let currentList;

const showStatsPage = async (list) => {
  currentList = list;
  hideAllPages();
  hideButtonBar();
  statsPage.style.display = 'block';
  const { intervals, datesDue } = await getStats(list);
  const dataForIntervalChart = [];
  intervals.forEach((interval) => {
    while (dataForIntervalChart.length + 1 < +interval.interval) {
      dataForIntervalChart.push(0);
    }
    dataForIntervalChart.push(interval.frequency);
  });

  getIntervalChart(canvas, dataForIntervalChart, Math.min(400, statsPage.offsetWidth - 40), 100);

  // ${intervals
  //   .map((x) => `<tr><td>${x.interval}</td><td>${x.frequency}</td></tr>`)
  //   .join('')}
  dueTable.innerHTML = `
  <table style="width:100%">
    <thead>
      <tr>
        <th>Date due</th>
        <th>Number of words</th>
      </tr>
    </thead>
    <tbody>${datesDue.map((x) => `<tr><td>${x.dateDue}</td><td>${x.frequency}</td></tr>`).join('')}
    </tbody>
  </table>`;
};

statsPage.addEventListener('click', () => {
  publish('DO_LIST', currentList);
});

export { showStatsPage };
