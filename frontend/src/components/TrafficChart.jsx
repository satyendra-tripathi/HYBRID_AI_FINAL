import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const TrafficChart = ({ data, type = 'line' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#06b6d4"
            strokeWidth={3}
            dot={{ fill: '#06b6d4', r: 4 }}
            activeDot={{ r: 6 }}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Legend />
          <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'pie') {
    const COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#06b6d4"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            labelStyle={{ color: '#f1f5f9' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
};

export default TrafficChart;
