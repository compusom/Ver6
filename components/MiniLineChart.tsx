import React from 'react';

interface MiniLineChartProps {
    data: { date: string, value: number }[];
    color?: string;
    height?: number;
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({ data, color = '#F97316', height = 60 }) => {
    if (!data || data.length < 2) {
        return <div style={{ height: `${height}px` }} className="flex items-center justify-center text-xs text-brand-text-secondary">No hay datos de tendencia</div>;
    }

    const width = 300; // Fixed width for simplicity
    const padding = 5;

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    const getX = (index: number) => {
        return (index / (data.length - 1)) * (width - 2 * padding) + padding;
    };

    const getY = (value: number) => {
        const range = maxValue - minValue;
        if (range === 0) return height / 2;
        return (height - 2 * padding) - ((value - minValue) / range) * (height - 2 * padding) + padding;
    };

    const pathData = data.map((point, i) => {
        const x = getX(i);
        const y = getY(point.value);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    const areaPathData = `${pathData} L ${getX(data.length - 1)},${height} L ${getX(0)},${height} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
            <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPathData} fill={`url(#gradient-${color.replace('#', '')})`} />
            <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};
