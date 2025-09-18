import React, { memo, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';

const InventoryOverview = memo(({ data, showChart = true }) => {
  const mockInventoryData = useMemo(() => data || [
    { category: 'Dinner Plates', available: 850, total: 1000, utilization: 85, color: '#1E40AF' },
    { category: 'Cups & Glasses', available: 420, total: 500, utilization: 84, color: '#10B981' },
    { category: 'Cutleries', available: 1200, total: 1500, utilization: 80, color: '#F59E0B' },
    { category: 'Bowls', available: 280, total: 400, utilization: 70, color: '#EF4444' },
    { category: 'Serving Dishes', available: 95, total: 150, utilization: 63, color: '#8B5CF6' }
  ], [data]);

  const chartData = useMemo(() => mockInventoryData?.map(item => ({
    name: item?.category,
    value: item?.total - item?.available,
    available: item?.available,
    total: item?.total,
    color: item?.color
  })), [mockInventoryData]);

  const getUtilizationColor = (utilization) => {
    if (utilization >= 80) return 'text-error';
    if (utilization >= 60) return 'text-warning';
    return 'text-success';
  };

  const getUtilizationBg = (utilization) => {
    if (utilization >= 80) return 'bg-error/10';
    if (utilization >= 60) return 'bg-warning/10';
    return 'bg-success/10';
  };

  const CustomTooltip = useCallback(({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-pronounced">
          <p className="font-medium text-popover-foreground mb-2">{data?.name}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">In Use:</span>
              <span className="font-medium">{data?.value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium">{data?.available}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{data?.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilization:</span>
              <span className="font-medium">{Math.round((data?.value / data?.total) * 100)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Inventory Overview</h3>
        <button className="text-sm text-primary hover:text-primary/80 transition-colors">
          View Details
        </button>
      </div>
      {showChart && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData?.map((entry, index) => (
                  <Cell key={`cell-${entry?.name}-${index}`} fill={entry?.color} />
                ))}
              </Pie>
              <Tooltip content={CustomTooltip} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="space-y-3">
        {mockInventoryData?.map((item, index) => (
          <div key={`${item?.category}-${index}`} className={`p-4 rounded-lg border border-border ${getUtilizationBg(item?.utilization)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: item?.color }}
                />
                <h4 className="font-medium text-foreground">{item?.category}</h4>
              </div>
              <div className={`flex items-center space-x-1 ${getUtilizationColor(item?.utilization)}`}>
                <Icon 
                  name={item?.utilization >= 80 ? "AlertTriangle" : item?.utilization >= 60 ? "AlertCircle" : "CheckCircle"} 
                  size={16} 
                />
                <span className="text-sm font-medium">{item?.utilization}%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Available: {item?.available}</span>
              <span>Total: {item?.total}</span>
              <span>In Use: {item?.total - item?.available}</span>
            </div>
            
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${item?.utilization}%`,
                    backgroundColor: item?.color
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {mockInventoryData?.reduce((sum, item) => sum + item?.total, 0)?.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Items</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-success">
            {mockInventoryData?.reduce((sum, item) => sum + item?.available, 0)?.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Available</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-warning">
            {mockInventoryData?.reduce((sum, item) => sum + (item?.total - item?.available), 0)?.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">In Use</div>
        </div>
      </div>
    </div>
  );
});

export default InventoryOverview;