import { describe, it, expect } from 'vitest';
import db, { dbConnectionStatus } from './database';

describe('database module', () => {
  it('exports dbConnectionStatus defaults', () => {
    expect(dbConnectionStatus.connected).toBe(false);
    expect(dbConnectionStatus.serverAvailable).toBe(false);
  });

  it('has a default export', () => {
    expect(db).toBeDefined();
  });
});
