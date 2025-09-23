import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Calendar, Award, TrendingUp, Clock, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function HRDashboard() {
  const { user } = useAuth();

  const hrStats = {
    totalEmployees: 156,
    newHires: 8,
    turnoverRate: 12.5,
    satisfactionScore: 4.2,
    openPositions: 12,
    attendanceRate: 96.8
  };

  const recentHires = [
    { id: 1, name: "Alex Thompson", position: "Software Engineer", startDate: "2025-09-20", department: "Engineering" },
    { id: 2, name: "Maria Garcia", position: "Marketing Specialist", startDate: "2025-09-18", department: "Marketing" },
    { id: 3, name: "David Kim", position: "Product Manager", startDate: "2025-09-15", department: "Product" },
    { id: 4, name: "Sarah Wilson", position: "UX Designer", startDate: "2025-09-10", department: "Design" }
  ];

  const departmentStats = [
    { name: "Engineering", employees: 45, vacancies: 5, satisfaction: 4.3 },
    { name: "Marketing", employees: 28, vacancies: 2, satisfaction: 4.1 },
    { name: "Sales", employees: 32, vacancies: 3, satisfaction: 4.0 },
    { name: "Operations", employees: 25, vacancies: 1, satisfaction: 4.4 },
    { name: "HR", employees: 12, vacancies: 0, satisfaction: 4.5 },
    { name: "Finance", employees: 14, vacancies: 1, satisfaction: 4.2 }
  ];

  const upcomingEvents = [
    { id: 1, title: "Team Building Workshop", date: "Sep 25", type: "Training" },
    { id: 2, title: "Performance Review Cycle", date: "Sep 30", type: "Review" },
    { id: 3, title: "New Employee Orientation", date: "Oct 2", type: "Onboarding" },
    { id: 4, title: "Benefits Information Session", date: "Oct 5", type: "Benefits" }
  ];

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "Training": return "bg-blue-100 text-blue-600";
      case "Review": return "bg-purple-100 text-purple-600";
      case "Onboarding": return "bg-green-100 text-green-600";
      case "Benefits": return "bg-orange-100 text-orange-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-teal-800 dark:text-teal-400" data-testid="hr-dashboard-title">
            HR Dashboard
          </h1>
          <p className="text-muted-foreground">Manage workforce and employee engagement</p>
          {user && <p className="text-sm text-muted-foreground">HR Manager: {user.username}</p>}
        </div>
        <Badge variant="outline" className="text-teal-600">
          <Users className="w-4 h-4 mr-1" />
          {hrStats.totalEmployees} Employees
        </Badge>
      </div>

      {/* HR Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-teal-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700" data-testid="total-employees">
              {hrStats.totalEmployees}
            </div>
            <p className="text-xs text-muted-foreground">+{hrStats.newHires} new hires this month</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
            <Award className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="satisfaction-score">
              {hrStats.satisfactionScore}/5.0
            </div>
            <p className="text-xs text-muted-foreground">+0.3 from last quarter</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="attendance-rate">
              {hrStats.attendanceRate}%
            </div>
            <p className="text-xs text-muted-foreground">Above company target</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700" data-testid="open-positions">
              {hrStats.openPositions}
            </div>
            <p className="text-xs text-muted-foreground">Across all departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Satisfaction Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="w-5 h-5 mr-2 text-teal-600" />
            Employee Satisfaction Trend
          </CardTitle>
          <CardDescription>Average satisfaction score across all departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Score: {hrStats.satisfactionScore}/5.0</span>
              <span>{(hrStats.satisfactionScore / 5 * 100).toFixed(0)}%</span>
            </div>
            <Progress value={hrStats.satisfactionScore / 5 * 100} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Target: 4.5/5.0 (90%)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Hires */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-green-600" />
              Recent Hires
            </CardTitle>
            <CardDescription>New team members who joined recently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentHires.map((hire) => (
                <div key={hire.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`hire-${hire.id}`}>
                  <div>
                    <p className="font-medium">{hire.name}</p>
                    <p className="text-sm text-muted-foreground">{hire.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{hire.department}</p>
                    <p className="text-xs text-muted-foreground">{hire.startDate}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Department Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Department Overview
            </CardTitle>
            <CardDescription>Employee distribution and satisfaction by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {departmentStats.map((dept, index) => (
                <div key={index} className="p-3 border rounded-lg" data-testid={`department-${index}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium">{dept.name}</p>
                    <div className="text-right">
                      <p className="text-sm font-bold">{dept.employees} employees</p>
                      <p className="text-xs text-orange-600">{dept.vacancies} open roles</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">Satisfaction: {dept.satisfaction}/5.0</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming HR Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-purple-600" />
            Upcoming HR Events
          </CardTitle>
          <CardDescription>Scheduled training, reviews, and activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="p-3 border rounded-lg" data-testid={`event-${event.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium">{event.title}</p>
                  <Badge className={getEventTypeColor(event.type)} variant="secondary">
                    {event.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{event.date}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button className="bg-teal-600 hover:bg-teal-700" data-testid="button-employee-management">
          <Users className="w-4 h-4 mr-2" />
          Employee Management
        </Button>
        <Button variant="outline" data-testid="button-recruitment">
          <UserCheck className="w-4 h-4 mr-2" />
          Recruitment
        </Button>
        <Button variant="outline" data-testid="button-performance-reviews">
          <Award className="w-4 h-4 mr-2" />
          Performance Reviews
        </Button>
        <Button variant="outline" data-testid="button-training-programs">
          <Calendar className="w-4 h-4 mr-2" />
          Training Programs
        </Button>
      </div>
    </div>
  );
}