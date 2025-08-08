export function parseDateForSort(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        // Excel serial number (days since 1899-12-30)
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return isNaN(date.getTime()) ? null : date;
    }
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const parts = value.split('/');
        if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}
