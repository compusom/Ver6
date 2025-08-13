import fs from 'fs';
import path from 'path';

class SQLDebugLogger {
    constructor() {
        this.logs = [];
        this.logFile = path.join(process.cwd(), 'sql-debug.log');
        this.startTime = new Date();
        
        // Clear previous log
        try {
            fs.writeFileSync(this.logFile, `=== SQL Debug Session Started at ${this.startTime.toISOString()} ===\n\n`);
        } catch (e) {
            console.error('Could not create log file:', e.message);
        }
    }
    
    log(level, category, message, data = null) {
        const timestamp = new Date();
        const entry = {
            timestamp: timestamp.toISOString(),
            level,
            category,
            message,
            data: data ? JSON.stringify(data, null, 2) : null,
            elapsedMs: timestamp - this.startTime
        };
        
        this.logs.push(entry);
        
        // Format for console
        const levelEmoji = {
            'INFO': 'ℹ️',
            'WARN': '⚠️',
            'ERROR': '❌',
            'SUCCESS': '✅',
            'DEBUG': '🔍',
            'SQL': '📜'
        };
        
        const logLine = `[${timestamp.toISOString()}] ${levelEmoji[level] || '•'} [${category}] ${message}`;
        console.log(logLine);
        
        if (data) {
            console.log('   Data:', JSON.stringify(data, null, 2));
        }
        
        // Write to file
        try {
            let fileContent = logLine + '\n';
            if (data) {
                fileContent += `   Data: ${JSON.stringify(data, null, 2)}\n`;
            }
            fileContent += '\n';
            
            fs.appendFileSync(this.logFile, fileContent);
        } catch (e) {
            console.error('Could not write to log file:', e.message);
        }
    }
    
    info(category, message, data) {
        this.log('INFO', category, message, data);
    }
    
    warn(category, message, data) {
        this.log('WARN', category, message, data);
    }
    
    error(category, message, data) {
        this.log('ERROR', category, message, data);
    }
    
    success(category, message, data) {
        this.log('SUCCESS', category, message, data);
    }
    
    debug(category, message, data) {
        this.log('DEBUG', category, message, data);
    }
    
    sql(category, message, sqlQuery) {
        this.log('SQL', category, message, { sql: sqlQuery });
    }
    
    logError(category, message, error) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            number: error.number,
            severity: error.severity,
            state: error.state,
            class: error.class,
            serverName: error.serverName,
            procName: error.procName,
            lineNumber: error.lineNumber,
            originalError: error.originalError,
            info: error.info
        };
        
        // Filter out undefined values
        Object.keys(errorData).forEach(key => {
            if (errorData[key] === undefined) {
                delete errorData[key];
            }
        });
        
        this.log('ERROR', category, message, errorData);
    }
    
    getLogSummary() {
        const summary = {
            totalLogs: this.logs.length,
            errors: this.logs.filter(l => l.level === 'ERROR').length,
            warnings: this.logs.filter(l => l.level === 'WARN').length,
            sqlQueries: this.logs.filter(l => l.level === 'SQL').length,
            duration: new Date() - this.startTime,
            logFile: this.logFile
        };
        
        return summary;
    }
    
    getAllLogs() {
        return this.logs;
    }
    
    saveFullReport() {
        const report = {
            session: {
                startTime: this.startTime.toISOString(),
                endTime: new Date().toISOString(),
                duration: new Date() - this.startTime
            },
            summary: this.getLogSummary(),
            logs: this.logs
        };
        
        const reportFile = path.join(process.cwd(), 'sql-debug-report.json');
        try {
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            this.info('REPORT', `Full debug report saved to: ${reportFile}`);
            return reportFile;
        } catch (e) {
            this.error('REPORT', 'Could not save debug report', e);
            return null;
        }
    }
}

export default SQLDebugLogger;