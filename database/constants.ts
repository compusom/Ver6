export const CRITICAL_TABLES = ['users', 'logged_in_user', 'config'] as const;
export type CriticalTable = typeof CRITICAL_TABLES[number];
