type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
export type LogEntry = {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: any;
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

    private addLog(level: LogLevel, message: string, context?: any) {
        const entry: LogEntry = { timestamp: new Date(), level, message, context };
        this.logs.push(entry);
        if (this.logs.length > 200) {
            this.logs.shift(); // Keep logs from growing indefinitely
        }
        this.subscribers.forEach(callback => callback(entry));
        
        // Also log to console for debugging
        const consoleArgs = [`[${level}] ${message}`];
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

    public info(message: string, context?: any) {
        this.addLog('INFO', message, context);
    }
    public success(message: string, context?: any) {
        this.addLog('SUCCESS', message, context);
    }
    public warn(message: string, context?: any) {
        this.addLog('WARNING', message, context);
    }
    public error(message: string, context?: any) {
        this.addLog('ERROR', message, context);
    }
     public debug(message: string, context?: any) {
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
