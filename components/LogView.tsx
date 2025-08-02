import React, { useState, useEffect, useRef } from 'react';
import Logger, { LogEntry } from '../Logger';

const levelColors: { [key in LogEntry['level']]: string } = {
    INFO: 'text-brand-text-secondary',
    SUCCESS: 'text-green-400',
    WARNING: 'text-yellow-400',
    ERROR: 'text-red-400',
    DEBUG: 'text-blue-400',
};

export const LogView: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>(Logger.getLogs());
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleNewLog = (newLog: LogEntry) => {
            setLogs(prev => [...prev, newLog]);
        };

        const unsubscribe = Logger.subscribe(handleNewLog);
        
        // Also resync in case logs were cleared
        setLogs(Logger.getLogs());

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Auto-scroll to bottom
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const handleClearLogs = () => {
        Logger.clear();
        setLogs([]); // Immediately clear view
    };

    return (
        <div className="max-w-7xl mx-auto bg-brand-surface rounded-lg p-6 shadow-lg animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-brand-text">System Logs</h2>
                <button
                    onClick={handleClearLogs}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Clear Logs
                </button>
            </div>
            <div
                ref={logContainerRef}
                className="bg-brand-bg p-4 rounded-md font-mono text-xs h-96 overflow-y-auto w-full"
            >
                {logs.map((log, i) => (
                    <div key={i} className={`flex gap-4 items-start whitespace-pre-wrap border-b border-brand-border/20 py-1 ${levelColors[log.level]}`}>
                        <span className="flex-shrink-0 font-semibold">{log.timestamp.toLocaleTimeString()}</span>
                        <p className="flex-grow">{log.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
