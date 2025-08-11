import normalizeName from './normalizeName.js';

export function toDateISO(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (ymd.test(str)) return str;
  const dmy = /^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/;
  const m = str.match(dmy);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

export function toNumberES(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  const cleaned = String(val)
    .replace(/[\s€$]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isFinite(num) ? num : null;
}

export function toPct(val: any): number | null {
  const num = toNumberES(val);
  if (num === null) return null;
  return num > 1.2 ? num / 100 : num;
}

export function normName(name: string): string {
  return normalizeName(name);
}

export default { toDateISO, toNumberES, toPct, normName };
