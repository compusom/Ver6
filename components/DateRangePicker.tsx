import React, { useState, useEffect } from 'react';

interface DateRangePickerProps {
    onDateChange: (startDate: string, endDate: string) => void;
    startDate: string;
    endDate: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ onDateChange, startDate: initialStartDate, endDate: initialEndDate }) => {
    
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [activePreset, setActivePreset] = useState<string>('');

    useEffect(() => {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    const handleApply = () => {
        onDateChange(startDate, endDate);
    };

    const handlePresetClick = (days: number, id: string) => {
        const newEndDate = new Date();
        const newStartDate = new Date();
        newStartDate.setDate(newEndDate.getDate() - days);
        
        const start = newStartDate.toISOString().split('T')[0];
        const end = newEndDate.toISOString().split('T')[0];
        
        setStartDate(start);
        setEndDate(end);
        setActivePreset(id);
        onDateChange(start, end);
    };
    
    const handleDateInputChange = () => {
        setActivePreset(''); // De-select preset if custom dates are used
    }

    return (
        <div className="flex flex-col items-stretch gap-2 bg-brand-border/30 p-2 rounded-lg">
             <div className="flex items-center justify-around gap-1">
                 <button onClick={() => handlePresetClick(7, '7d')} className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${activePreset === '7d' ? 'bg-brand-primary text-white' : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-surface'}`}>7 días</button>
                 <button onClick={() => handlePresetClick(15, '15d')} className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${activePreset === '15d' ? 'bg-brand-primary text-white' : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-surface'}`}>15 días</button>
                 <button onClick={() => handlePresetClick(30, '30d')} className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${activePreset === '30d' ? 'bg-brand-primary text-white' : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-surface'}`}>30 días</button>
             </div>
             <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="flex items-center gap-2 w-full">
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); handleDateInputChange(); }}
                        className="bg-brand-bg border border-brand-border text-brand-text rounded-md p-1.5 text-sm w-full focus:ring-brand-primary focus:border-brand-primary"
                    />
                     <span className="text-brand-text-secondary">-</span>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); handleDateInputChange(); }}
                        className="bg-brand-bg border border-brand-border text-brand-text rounded-md p-1.5 text-sm w-full focus:ring-brand-primary focus:border-brand-primary"
                    />
                </div>
                <button
                    onClick={handleApply}
                    className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm"
                >
                    Aplicar
                </button>
            </div>
        </div>
    );
};