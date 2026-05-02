import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SeverityTimelineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No severity timeline data available
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              borderColor: '#334155',
              borderRadius: '8px',
              color: '#f8fafc'
            }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Legend iconType="circle" />
          <Area
            type="monotone"
            dataKey="Low"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorLow)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Medium"
            stroke="#eab308"
            fillOpacity={1}
            fill="url(#colorMedium)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="High"
            stroke="#f97316"
            fillOpacity={1}
            fill="url(#colorHigh)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Critical"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorCritical)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SeverityTimelineChart;
