import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { DataSource, DATA_SOURCE_STORAGE_KEY } from '../constants';
import Logger from '../Logger';

interface DataSourceContextValue {
  dataSource: DataSource;
  setDataSource: (ds: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceContextValue | undefined>(undefined);

export const DataSourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSource, setDataSourceState] = useState<DataSource>(() => {
    const stored = localStorage.getItem(DATA_SOURCE_STORAGE_KEY) as DataSource | null;
    return stored === DataSource.SQL ? DataSource.SQL : DataSource.LOCAL;
  });

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    Logger.info(`[DS] loaded ${dataSource}`);
  }, [dataSource]);

  const setDataSource = (ds: DataSource) => {
    setDataSourceState(ds);
    localStorage.setItem(DATA_SOURCE_STORAGE_KEY, ds);
    Logger.info(`[DS] switched to ${ds}`);
  };

  return (
    <DataSourceContext.Provider value={{ dataSource, setDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
};

export const useDataSource = () => {
  const ctx = useContext(DataSourceContext);
  if (!ctx) throw new Error('useDataSource must be used within DataSourceProvider');
  return ctx;
};
