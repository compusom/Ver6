import React from 'react';
import { DataSource } from '../constants';
import { useDataSource } from '../context/DataSourceContext';

export const DataSourceSwitch: React.FC = () => {
  const { dataSource, setDataSource } = useDataSource();
  return (
    <div className="flex rounded-lg bg-brand-border p-1">
      <button
        onClick={() => setDataSource(DataSource.LOCAL)}
        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dataSource === DataSource.LOCAL ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}
      >
        Local
      </button>
      <button
        onClick={() => setDataSource(DataSource.SQL)}
        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${dataSource === DataSource.SQL ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}
      >
        SQL Express
      </button>
    </div>
  );
};
