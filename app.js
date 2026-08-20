const state = { rows: [], filtered: [], geoRows: [], plottedPoints: [] };
const colors = { lime: '#d4ef4a', orange: '#ef7651', teal: '#155c56', ink: '#17231f', muted: '#718079', grid: '#e5ebe5' };
let trendChart; let areaChart;

const cleanNumber = (value) => Number.parseFloat(String(value ?? '').replace(/,/g, '').trim()) || 0;
const parseDate = (value) => { const [day, month, year] = String(value).trim().split('-'); return new Date(Number(year), Number(month) - 1, Number(day)); };
const formatRate = (value) => `${value.toFixed(1)}%`;
const formatPeople = (value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}K`;
const monthLabel = (date) => date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headerCounts = {}; const headers = lines.shift().split(',').map((header) => { const cleanHeader = header.trim(); headerCounts[cleanHeader] = (headerCounts[cleanHeader] || 0) + 1; return headerCounts[cleanHeader] === 1 ? cleanHeader : `${cleanHeader}_${headerCounts[cleanHeader]}`; });
  return lines.map((line) => {
    const values = []; let value = ''; let quoted = false;
    for (const character of line) {
      if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) { values.push(value); value = ''; }
      else value += character;
    }
    values.push(value);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function normalise(row) {
  return { region: row.Region?.trim(), date: parseDate(row.Date), area: row.Area?.trim() || 'Unknown', rate: cleanNumber(row['Estimated Unemployment Rate (%)']), employed: cleanNumber(row['Estimated Employed']), participation: cleanNumber(row['Estimated Labour Participation Rate (%)']) };
}

function applyFilters() {
  const region = document.querySelector('#regionFilter').value;
  const area = document.querySelector('#areaFilter').value;
  const period = document.querySelector('#dateFilter').value;
  state.filtered = state.rows.filter((row) => {
    const inRegion = region === 'All India' || row.region === region;
    const inArea = area === 'All' || row.area === area;
    const inPeriod = period === 'all' || (period === '2020' && row.date.getFullYear() === 2020) || (period === 'pre-covid' && row.date < new Date(2020, 2, 1));
    return inRegion && inArea && inPeriod;
  });
  renderDashboard();
}

function monthlyAverage(rows) {
  const grouped = new Map();
  rows.forEach((row) => { const key = `${row.date.getFullYear()}-${row.date.getMonth()}`; const bucket = grouped.get(key) || { date: row.date, rates: [], participation: [] }; bucket.rates.push(row.rate); bucket.participation.push(row.participation); grouped.set(key, bucket); });
  return [...grouped.values()].sort((a, b) => a.date - b.date).map((bucket) => ({ date: bucket.date, rate: bucket.rates.reduce((a, b) => a + b, 0) / bucket.rates.length, participation: bucket.participation.reduce((a, b) => a + b, 0) / bucket.participation.length }));
}

function renderDashboard() {
  const rows = state.filtered; if (!rows.length) return;
  const average = rows.reduce((sum, row) => sum + row.rate, 0) / rows.length;
  const peak = rows.reduce((max, row) => row.rate > max.rate ? row : max, rows[0]);
  const latestDate = rows.reduce((latest, row) => row.date > latest.date ? row : latest, rows[0]).date;
  const latestRows = rows.filter((row) => row.date.getTime() === latestDate.getTime());
  const employed = latestRows.reduce((sum, row) => sum + row.employed, 0);
  const baseline = rows.filter((row) => row.date.getFullYear() === 2019).reduce((sum, row) => sum + row.rate, 0) / Math.max(1, rows.filter((row) => row.date.getFullYear() === 2019).length);
  const aprilRows = rows.filter((row) => row.date.getFullYear() === 2020 && row.date.getMonth() === 3);
  const april = aprilRows.reduce((sum, row) => sum + row.rate, 0) / Math.max(1, aprilRows.length);
  document.querySelector('#avgRate').textContent = formatRate(average);
  document.querySelector('#avgTrend').textContent = `${average >= baseline ? '+' : ''}${(average - baseline).toFixed(1)} pts`;
  document.querySelector('#peakRate').textContent = formatRate(peak.rate);
  document.querySelector('#peakDate').textContent = peak.date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  document.querySelector('#employed').textContent = formatPeople(employed);
  document.querySelector('#covidImpact').textContent = `${(april - baseline).toFixed(1)} pts`;
  document.querySelector('#areaAverage').textContent = formatRate(average);
  document.querySelector('#stateMeta').textContent = `${new Set(rows.map((row) => row.region)).size} states · ${rows.length} observations`;
  renderTrend(monthlyAverage(rows)); renderArea(rows); renderStates(rows); renderGeo(rows);
}

function renderTrend(points) {
  if (trendChart) trendChart.destroy(); const ctx = document.querySelector('#trendChart');
  trendChart = new Chart(ctx, { type: 'line', data: { labels: points.map((point) => monthLabel(point.date)), datasets: [{ label: 'Unemployment rate', data: points.map((point) => point.rate.toFixed(2)), borderColor: colors.teal, backgroundColor: 'rgba(21,92,86,.08)', fill: true, tension: .35, pointRadius: 2, pointBackgroundColor: colors.lime, borderWidth: 2 }, { label: 'Labour participation', data: points.map((point) => point.participation.toFixed(2)), borderColor: colors.orange, borderDash: [5, 5], tension: .35, pointRadius: 0, borderWidth: 1.5 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { backgroundColor: colors.ink, padding: 12, displayColors: false, callbacks: { label: (item) => `${item.dataset.label}: ${item.formattedValue}%` } } }, scales: { x: { grid: { display: false }, ticks: { color: colors.muted, maxTicksLimit: 8, font: { family: 'DM Mono', size: 9 } } }, y: { grid: { color: colors.grid }, ticks: { color: colors.muted, font: { family: 'DM Mono', size: 9 }, callback: (value) => `${value}%` }, beginAtZero: true } } } });
}

function renderArea(rows) {
  const values = ['Rural', 'Urban'].map((area) => ({ area, rate: rows.filter((row) => row.area === area).reduce((sum, row) => sum + row.rate, 0) / Math.max(1, rows.filter((row) => row.area === area).length) }));
  if (areaChart) areaChart.destroy(); areaChart = new Chart(document.querySelector('#areaChart'), { type: 'doughnut', data: { labels: values.map((item) => item.area), datasets: [{ data: values.map((item) => item.rate), backgroundColor: [colors.lime, colors.orange], borderWidth: 0, hoverOffset: 5 }] }, options: { cutout: '76%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: colors.ink, callbacks: { label: (item) => `${item.label}: ${item.formattedValue}%` } } } } });
  document.querySelector('#areaLegend').innerHTML = values.map((item, index) => `<div><span><i class="legend-dot ${index ? 'orange' : 'lime'}"></i>${item.area}</span><span>${formatRate(item.rate)}</span></div>`).join('');
}

function renderStates(rows) {
  const grouped = [...new Set(rows.map((row) => row.region))].map((region) => { const matches = rows.filter((row) => row.region === region); return { region, rate: matches.reduce((sum, row) => sum + row.rate, 0) / matches.length }; }).sort((a, b) => b.rate - a.rate).slice(0, 8); const max = grouped[0]?.rate || 1;
  document.querySelector('#stateTable').innerHTML = grouped.map((item, index) => `<div class="state-row"><span class="state-name">${item.region}</span><span class="state-bar"><i style="width:${(item.rate / max) * 100}%"></i></span><span class="state-rate">${formatRate(item.rate)}</span><span class="state-rank">#${String(index + 1).padStart(2, '0')}</span></div>`).join('');
}

function renderGeo(rows) {
  const canvas = document.querySelector('#geoCanvas'); const context = canvas.getContext('2d'); const width = canvas.clientWidth; const height = canvas.clientHeight; const ratio = window.devicePixelRatio || 1; canvas.width = width * ratio; canvas.height = height * ratio; context.scale(ratio, ratio); context.clearRect(0, 0, width, height);
  context.fillStyle = '#f1f6ef'; context.fillRect(0, 0, width, height); context.strokeStyle = '#d9e5d8'; context.lineWidth = 1;
  for (let index = 1; index < 6; index += 1) { context.beginPath(); context.moveTo((width / 6) * index, 0); context.lineTo((width / 6) * index, height); context.stroke(); context.beginPath(); context.moveTo(0, (height / 6) * index); context.lineTo(width, (height / 6) * index); context.stroke(); }
  const grouped = [...new Map(state.geoRows.map((row) => [row.region, row])).values()].filter((row) => rows.some((item) => item.region === row.region)); const rates = grouped.map((row) => row.rate); const min = Math.min(...rates, 0); const max = Math.max(...rates, 1); state.plottedPoints = grouped.map((row) => { const x = ((row.longitude - 68) / 30) * width; const y = height - ((row.latitude - 7) / 30) * height; const intensity = (row.rate - min) / (max - min || 1); const radius = 4 + intensity * 6; context.beginPath(); context.fillStyle = `rgba(239,118,81,${.35 + intensity * .6})`; context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.beginPath(); context.fillStyle = colors.ink; context.arc(x, y, 2, 0, Math.PI * 2); context.fill(); return { ...row, x, y, radius }; });
  document.querySelector('#geoSummary').textContent = `${grouped.length} locations · ${formatRate(rates.reduce((sum, rate) => sum + rate, 0) / Math.max(1, rates.length))} average`;
}

function downloadFiltered() { const header = 'Region,Date,Area,Unemployment Rate,Employed,Labour Participation\n'; const body = state.filtered.map((row) => [row.region, row.date.toISOString().slice(0, 10), row.area, row.rate, row.employed, row.participation].join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' })); link.download = 'india-unemployment-filtered.csv'; link.click(); document.querySelector('#toast').classList.add('show'); setTimeout(() => document.querySelector('#toast').classList.remove('show'), 2200); }

async function init() { try { const [mainResponse, geoResponse] = await Promise.all([fetch('data/Unemployment in India.csv'), fetch('data/Unemployment_Rate_upto_11_2020.csv')]); if (!mainResponse.ok || !geoResponse.ok) throw new Error('One or more CSV files could not be loaded'); const result = parseCsv(await mainResponse.text()); const geoResult = parseCsv(await geoResponse.text()); state.rows = result.map(normalise).filter((row) => row.region && row.rate >= 0); state.geoRows = geoResult.map((row) => ({ region: row.Region?.trim(), latitude: cleanNumber(row.latitude), longitude: cleanNumber(row.longitude), rate: cleanNumber(row['Estimated Unemployment Rate (%)']) })).filter((row) => row.region && row.latitude && row.longitude); const regions = [...new Set(state.rows.map((row) => row.region))].sort(); document.querySelector('#regionFilter').insertAdjacentHTML('beforeend', regions.map((region) => `<option value="${region}">${region}</option>`).join('')); applyFilters(); } catch (error) { document.querySelector('#stateMeta').textContent = 'Could not load CSV'; console.error(error); } }

document.querySelectorAll('.nav-item[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(`#${button.dataset.scroll}`).scrollIntoView()));
document.querySelectorAll('select').forEach((select) => select.addEventListener('change', applyFilters));
document.querySelector('#resetButton').addEventListener('click', () => { document.querySelector('#regionFilter').value = 'All India'; document.querySelector('#areaFilter').value = 'All'; document.querySelector('#dateFilter').value = 'all'; applyFilters(); });
document.querySelector('#downloadButton').addEventListener('click', downloadFiltered);
document.querySelector('#geoCanvas').addEventListener('mousemove', (event) => { const bounds = event.currentTarget.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; const point = state.plottedPoints.find((item) => Math.hypot(item.x - x, item.y - y) < item.radius + 4); const tooltip = document.querySelector('#mapTooltip'); if (!point) { tooltip.classList.remove('visible'); return; } tooltip.textContent = `${point.region}: ${formatRate(point.rate)}`; tooltip.style.left = `${point.x + 12}px`; tooltip.style.top = `${point.y - 12}px`; tooltip.classList.add('visible'); });
window.addEventListener('resize', () => { if (state.filtered.length) renderGeo(state.filtered); });
init();