export function parseDateForSort(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        // Excel serial number (days since 1899-12-30)
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const numeric = Number(value);
        if (!isNaN(numeric)) return parseDateForSort(numeric);
        const parts = value.split(/[\/\-]/);
        if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}
