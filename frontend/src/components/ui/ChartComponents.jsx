import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';

// Custom dark styled tooltip for Recharts
export function CustomTooltip({ active, payload, label, formatter }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0b0f19]/95 border border-white/8 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs">
        <p className="text-slate-400 font-semibold mb-1.5">{label}</p>
        <div className="flex flex-col gap-1">
          {payload.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: item.color || item.fill }} 
              />
              <span className="text-slate-300 font-medium">{item.name}:</span>
              <span className="text-white font-bold">
                {formatter ? formatter(item.value) : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// 1. Area Chart for Revenue and Profits
export function FinancialAreaChart({ data, xKey = 'year', areaKeys = [], colors = [] }) {
  const formatCurrency = (value) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value}`;
  };

  const defaultColors = ['#3b82f6', '#10b981'];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data} 
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            {areaKeys.map((key, i) => {
              const color = colors[i] || defaultColors[i % defaultColors.length];
              return (
                <linearGradient key={key} id={`color_${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey={xKey} 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11}
            tickLine={false}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
          />
          {areaKeys.map((key, i) => {
            const color = colors[i] || defaultColors[i % defaultColors.length];
            return (
              <Area 
                key={key}
                name={key.replace('_', ' ').toUpperCase()}
                type="monotone" 
                dataKey={key} 
                stroke={color} 
                strokeWidth={2}
                fillOpacity={1} 
                fill={`url(#color_${key})`} 
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// 2. Bar Chart for Multi-Stock Comparison
export function ComparisonBarChart({ data, xKey = 'ticker', barKeys = [], colors = [] }) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey={xKey} 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11}
            tickLine={false}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
          {barKeys.map((key, i) => {
            const color = colors[i] || defaultColors[i % defaultColors.length];
            return (
              <Bar 
                key={key}
                name={key.replace('_', ' ').toUpperCase()}
                dataKey={key} 
                fill={color} 
                radius={[4, 4, 0, 0]}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 3. Line Chart for Margins and Returns (ROE/ROA)
export function FinancialLineChart({ data, xKey = 'year', lineKeys = [], colors = [] }) {
  const defaultColors = ['#c084fc', '#f43f5e'];

  const formatPercentage = (value) => `${value.toFixed(1)}%`;

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey={xKey} 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11}
            tickLine={false}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.3)" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={formatPercentage}
          />
          <Tooltip content={<CustomTooltip formatter={formatPercentage} />} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
          {lineKeys.map((key, i) => {
            const color = colors[i] || defaultColors[i % defaultColors.length];
            return (
              <Line 
                key={key}
                name={key.replace('_', ' ').toUpperCase()}
                type="monotone" 
                dataKey={key} 
                stroke={color} 
                strokeWidth={2}
                dot={{ stroke: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
