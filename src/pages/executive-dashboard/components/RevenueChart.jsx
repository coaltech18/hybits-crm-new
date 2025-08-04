import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const RevenueChart = ({ data, type = 'line', height = 300 }) => {
  const mockData = data || [
    { month: 'Jan', revenue: 45000, orders: 120, target: 50000 },
    { month: 'Feb', revenue: 52000, orders: 145, target: 50000 },
    { month: 'Mar', revenue: 48000, orders: 135, target: 50000 },
    { month: 'Apr', revenue: 61000, orders: 165, target: 55000 },
    { month: 'May', revenue: 55000, orders: 150, target: 55000 },
    { month: 'Jun', revenue: 67000, orders: 180, target: 60000 },
    { month: 'Jul', revenue: 71000, orders: 195, target: 60000 },
    { month: 'Aug', revenue: 69000, orders: 185, target: 65000 }
  ];

  const formatCurrency = (value) => {
    return `₹${(value / 1000)?.toFixed(0)}K`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-pronounced">
          <p className="font-medium text-popover-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry?.color }}
              />
              <span className="text-muted-foreground">{entry?.dataKey}:</span>
              <span className="font-medium text-popover-foreground">
                {entry?.dataKey === 'orders' ? entry?.value : formatCurrency(entry?.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'area') {
    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(30, 64, 175)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="rgb(30, 64, 175)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(229, 231, 235)" />
            <XAxis 
              dataKey="month" 
              stroke="rgb(107, 114, 128)"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              stroke="rgb(107, 114, 128)"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="rgb(30, 64, 175)"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={mockData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229, 231, 235)" />
          <XAxis 
            dataKey="month" 
            stroke="rgb(107, 114, 128)"
            fontSize={12}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            stroke="rgb(107, 114, 128)"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="rgb(30, 64, 175)"
            strokeWidth={3}
            dot={{ fill: 'rgb(30, 64, 175)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: 'rgb(30, 64, 175)', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke="rgb(107, 114, 128)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;