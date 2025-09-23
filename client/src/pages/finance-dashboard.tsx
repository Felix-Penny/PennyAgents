import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Calculator, PieChart, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export default function FinanceDashboard() {
  const { user } = useAuth();

  // Fetch financial data from backend API
  const { data: financialData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/finance'],
    enabled: !!user
  });

  const financialStats = financialData || {};
  const recentTransactions = financialData?.recentTransactions || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center" data-testid="loading-state">
          <p>Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center text-red-600" data-testid="error-state">
          <p>Error loading financial data. Please try again.</p>
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
          <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400" data-testid="finance-dashboard-title">
            Finance Dashboard
          </h1>
          <p className="text-muted-foreground">Track revenue, expenses, and financial performance</p>
          {user && <p className="text-sm text-muted-foreground">Financial Analyst: {user.username}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            Live Data
          </Badge>
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            Refresh
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="total-revenue">
              {formatCurrency(financialStats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">+12.5% from last quarter</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="monthly-profit">
              {formatCurrency(financialStats.monthlyProfit)}
            </div>
            <p className="text-xs text-muted-foreground">+8.2% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700" data-testid="total-expenses">
              {formatCurrency(financialStats.expenses)}
            </div>
            <p className="text-xs text-muted-foreground">-3.1% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Calculator className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700" data-testid="profit-margin">
              {financialStats.profitMargin}%
            </div>
            <p className="text-xs text-muted-foreground">Above industry average</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-blue-600" />
            Budget Utilization
          </CardTitle>
          <CardDescription>Current quarter budget usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used: {formatCurrency(financialStats.expenses)}</span>
              <span>{financialStats.budgetUtilization}% of budget</span>
            </div>
            <Progress value={financialStats.budgetUtilization} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {100 - financialStats.budgetUtilization}% budget remaining
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
            Recent Transactions
          </CardTitle>
          <CardDescription>Latest financial activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`transaction-${transaction.id}`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${transaction.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {transaction.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">{transaction.date}</p>
                  </div>
                </div>
                <div className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(transaction.amount))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-financial-reports">
          <BarChart3 className="w-4 h-4 mr-2" />
          View Financial Reports
        </Button>
        <Button variant="outline" data-testid="button-budget-planning">
          <Calculator className="w-4 h-4 mr-2" />
          Budget Planning
        </Button>
        <Button variant="outline" data-testid="button-expense-tracking">
          <PieChart className="w-4 h-4 mr-2" />
          Expense Tracking
        </Button>
      </div>
    </div>
  );
}