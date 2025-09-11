import { Card, CardContent } from "@/components/ui/card";
import { Video, AlertTriangle, Shield, Building2, TrendingUp, TrendingDown } from "lucide-react";

interface StatsOverviewProps {
  activeCameras: number;
  todayIncidents: number;
  preventionRate: number;
  networkStores: number;
}

export function StatsOverview({ 
  activeCameras, 
  todayIncidents, 
  preventionRate, 
  networkStores 
}: StatsOverviewProps) {
  // Calculate trend indicators (mock data for demo)
  const cameraTrend = 0; // No change from yesterday
  const incidentTrend = 2; // +2 from yesterday
  const preventionTrend = 3; // +3% this month
  const networkTrend = 0; // Network stable

  const TrendIcon = ({ trend }: { trend: number }) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="w-4 h-4 flex items-center justify-center">
      <div className="w-2 h-0.5 bg-gray-500"></div>
    </div>;
  };

  const formatTrend = (trend: number, type: 'number' | 'percentage' = 'number') => {
    if (trend === 0) return 'No change';
    const prefix = trend > 0 ? '+' : '';
    const suffix = type === 'percentage' ? '%' : '';
    return `${prefix}${trend}${suffix}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Active Cameras</p>
              <p className="text-2xl font-bold text-foreground">{activeCameras}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Video className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-500">●</span>
            <span className="text-muted-foreground ml-1">All systems operational</span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Today's Incidents</p>
              <p className="text-2xl font-bold text-foreground">{todayIncidents}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <TrendIcon trend={incidentTrend} />
            <span className={`ml-1 ${incidentTrend > 0 ? 'text-yellow-500' : incidentTrend < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
              {formatTrend(incidentTrend)} from yesterday
            </span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Prevention Rate</p>
              <p className="text-2xl font-bold text-foreground">{preventionRate}%</p>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <TrendIcon trend={preventionTrend} />
            <span className={`ml-1 ${preventionTrend > 0 ? 'text-green-500' : preventionTrend < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {formatTrend(preventionTrend, 'percentage')} this month
            </span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Network Stores</p>
              <p className="text-2xl font-bold text-foreground">{networkStores}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-blue-500">●</span>
            <span className="text-muted-foreground ml-1">Cross-network enabled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
