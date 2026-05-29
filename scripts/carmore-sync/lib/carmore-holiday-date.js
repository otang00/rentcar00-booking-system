function formatKstDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function getKstParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function isStartOfKstDay(value) {
  const parts = getKstParts(value);
  return parts.hour === '00' && parts.minute === '00' && parts.second === '00';
}

function buildHolidayDateRange({ startAt, endAt } = {}) {
  if (!startAt) throw new Error('startAt is required');
  if (!endAt) throw new Error('endAt is required');
  const startDate = formatKstDate(startAt);
  let endDate = formatKstDate(endAt);
  if (isStartOfKstDay(endAt)) {
    endDate = addDaysToDateString(endDate, -1);
  }
  if (endDate < startDate) endDate = startDate;
  return { holidayStartDate: startDate, holidayEndDate: endDate };
}

module.exports = {
  addDaysToDateString,
  buildHolidayDateRange,
  formatKstDate,
  getKstParts,
  isStartOfKstDay,
};
