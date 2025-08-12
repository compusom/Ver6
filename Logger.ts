type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
export type LogEntry = {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: unknown;
};
type Subscriber = (log: LogEntry) => void;

class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private subscribers: Subscriber[] = [];

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private addLog(level: LogLevel, message: string, context?: unknown) {
        const entry: LogEntry = { timestamp: new Date(), level, message, context };
        this.logs.push(entry);
        if (this.logs.length > 200) {
            this.logs.shift(); // Keep logs from growing indefinitely
        }
        this.subscribers.forEach(callback => callback(entry));
        
        // Also log to console for debugging
        const consoleArgs: any[] = [`[${level}] ${message}`];
        if (context) {
            consoleArgs.push(context);
        }
        switch(level) {
            case 'ERROR':
                console.error(...consoleArgs);
                break;
            case 'WARNING':
                console.warn(...consoleArgs);
                break;
            default:
                console.log(...consoleArgs);
        }
    }

    public info<TContext = unknown>(message: string, context?: TContext) {
        this.addLog('INFO', message, context);
    }
    public success<TContext = unknown>(message: string, context?: TContext) {
        this.addLog('SUCCESS', message, context);
    }
    public warn<TContext = unknown>(message: string, context?: TContext) {
        this.addLog('WARNING', message, context);
    }
    public error<TContext = unknown>(message: string, context?: TContext) {
        this.addLog('ERROR', message, context);
    }
     public debug<TContext = unknown>(message: string, context?: TContext) {
        this.addLog('DEBUG', message, context);
    }

    public getLogs(): LogEntry[] {
        return this.logs;
    }

    public subscribe(callback: Subscriber): () => void {
        this.subscribers.push(callback);
        // Return an unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    public clear() {
        this.logs = [];
        this.info('Logs cleared by user.');
    }
}

export default Logger.getInstance();
