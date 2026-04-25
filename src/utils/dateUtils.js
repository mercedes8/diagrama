export const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const getDow = (y, m, d) => new Date(y, m, d).getDay();

export function calcWorkingDays(year, month, holidays = []) {
  const total = getDaysInMonth(year, month);
  let working = 0;
  for (let d = 1; d <= total; d++) {
    const dow = getDow(year, month, d);
    if (dow !== 0) working++;
  }
  return working;
}
