import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, Target, ShoppingCart, Phone, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

interface SalesData {
  totalSales: number;
  avgDealSize: number;
  conversionRate: number;
  pipelineValue: number;
  activeLeads: number;
  monthlyTarget: number;
  targetProgress: number;
  recentDeals: Array<{
    id: string;
    client: string;
    store: string;
    value: number;
    stage: string;
    probability: number;
    date: string;
  }>;
  topPerformers: Array<{
    name: string;
    sales: number;
    deals: number;
  }>;
}

export default function SalesDashboard() {
  const { user } = useAuth();

  // Fetch sales data from backend API
  const { data: salesData, isLoading, error, refetch } = useQuery<SalesData>({
    queryKey: ['/api/sales'],
    enabled: !!user
  });

  const salesStats = salesData || {
    totalSales: 0,
    avgDealSize: 0,
    conversionRate: 0,
    pipelineValue: 0,
    activeLeads: 0,
    monthlyTarget: 500000,
    targetProgress: 0,
    recentDeals: [],
    topPerformers: []
  };
  const recentDeals = salesData?.recentDeals || [];
  const topPerformers = salesData?.topPerformers || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const targetProgress = salesStats.totalSales && salesStats.monthlyTarget ? 
    (salesStats.totalSales / salesStats.monthlyTarget) * 100 : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center" data-testid="loading-state">
          <p>Loading sales data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center text-red-600" data-testid="error-state">
          <p>Error loading sales data. Please try again.</p>
          <Button onClick={() => refetch()} className="mt-2" data-testid="button-retry">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-orange-800 dark:text-orange-400" data-testid="sales-dashboard-title">
            Sales Dashboard
          </h1>
          <p className="text-muted-foreground">Track sales performance and manage customer relationships</p>
          {user && <p className="text-sm text-muted-foreground">Sales Manager: {user.username}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            Live Data
          </Badge>
          <Badge variant="outline" className="text-orange-600">
            <Target className="w-4 h-4 mr-1" />
            {targetProgress.toFixed(0)}% to Target
          </Badge>
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            Refresh
          </Button>
        </div>
      </div>

      {/* Sales Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700" data-testid="total-sales">
              {formatCurrency(salesStats.totalSales)}
            </div>
            <p className="text-xs text-muted-foreground">+18.2% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="active-leads">
              {salesStats.activeLeads}
            </div>
            <p className="text-xs text-muted-foreground">12 new this week</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="conversion-rate">
              {salesStats.conversionRate}%
            </div>
            <p className="text-xs text-muted-foreground">Above industry average</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700" data-testid="avg-deal-size">
              {formatCurrency(salesStats.avgDealSize)}
            </div>
            <p className="text-xs text-muted-foreground">+5.3% from last quarter</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Target Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2 text-orange-600" />
            Monthly Target Progress
          </CardTitle>
          <CardDescription>Current progress towards monthly sales goal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Achieved: {formatCurrency(salesStats.totalSales)}</span>
              <span>Target: {formatCurrency(salesStats.monthlyTarget)}</span>
            </div>
            <Progress value={targetProgress} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(salesStats.monthlyTarget - salesStats.totalSales)} remaining to reach target
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Sales Pipeline
            </CardTitle>
            <CardDescription>Active deals in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDeals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`deal-${deal.id}`}>
                  <div>
                    <p className="font-medium">{deal.client}</p>
                    <p className="text-sm text-muted-foreground">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(deal.value)}</p>
                    <p className="text-xs text-muted-foreground">{deal.probability}% probability</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-600" />
              Top Performers
            </CardTitle>
            <CardDescription>Best performing sales team members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <div key={performer.name} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`performer-${index}`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{performer.name}</p>
                      <p className="text-sm text-muted-foreground">{performer.deals} deals closed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(performer.sales)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-manage-leads">
          <Users className="w-4 h-4 mr-2" />
          Manage Leads
        </Button>
        <Button variant="outline" data-testid="button-create-proposal">
          <Mail className="w-4 h-4 mr-2" />
          Create Proposal
        </Button>
        <Button variant="outline" data-testid="button-schedule-call">
          <Phone className="w-4 h-4 mr-2" />
          Schedule Call
        </Button>
        <Button variant="outline" data-testid="button-sales-reports">
          <TrendingUp className="w-4 h-4 mr-2" />
          Sales Reports
        </Button>
      </div>
    </div>
  );
}