export function normalizeName(raw: string): string {
  if (!raw) return '';
  const collapsed = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return collapsed;
}
export default normalizeName;
