import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, DollarSign, TrendingUp, Settings, Users, LogIn, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function PortalSelectPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const { loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (credentials: { username: string; password: string }) => {
    try {
      const user = await loginMutation.mutateAsync(credentials);
      
      // Redirect to multi-agent platform dashboard
      setLocation('/platform');
    } catch (error: any) {
      toast({
        title: "Login failed", 
        description: error.message || "Please check your credentials",
        variant: "destructive"
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }
    try {
      const user = await registerMutation.mutateAsync(registerData);
      // Redirect to multi-agent platform dashboard
      setLocation('/platform');
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  };

  // Agent preview icons
  const agentPreviews = [
    { icon: Shield, name: "Security", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900" },
    { icon: DollarSign, name: "Finance", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900" },
    { icon: TrendingUp, name: "Sales", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900" },
    { icon: Settings, name: "Operations", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900" },
    { icon: Users, name: "HR", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4" data-testid="text-page-title">Penny Multi-Agent Platform</h1>
          <p className="text-muted-foreground text-xl mb-8">
            Unified business intelligence across all sectors
          </p>
          
          {/* Agent Preview Icons */}
          <div className="flex justify-center space-x-4 mb-8">
            {agentPreviews.map((agent, index) => (
              <div key={agent.name} className={`p-3 rounded-full ${agent.bg} transition-transform hover:scale-110`}>
                <agent.icon className={`w-6 h-6 ${agent.color}`} />
              </div>
            ))}
          </div>
        </div>
        
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl" data-testid="card-login">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl">Access Platform</CardTitle>
              <CardDescription className="text-base">
                Log in to access your assigned business agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="tab-login">
                    <LogIn className="w-4 h-4 mr-2" />Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" data-testid="tab-signup">
                    <UserPlus className="w-4 h-4 mr-2" />Sign Up
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      data-testid="input-username"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      data-testid="input-password"
                      className="h-12"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 text-lg" 
                    onClick={() => handleLogin({ username, password })}
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "Logging in..." : "Access Platform"}
                  </Button>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          data-testid="input-firstName"
                          type="text"
                          value={registerData.firstName}
                          onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                          placeholder="Enter first name"
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          data-testid="input-lastName"
                          type="text"
                          value={registerData.lastName}
                          onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                          placeholder="Enter last name"
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-username">Username</Label>
                      <Input
                        id="reg-username"
                        data-testid="input-reg-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        placeholder="Choose a username"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        data-testid="input-email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        placeholder="Enter your email"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input
                        id="reg-password"
                        data-testid="input-reg-password"
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        placeholder="Create a password"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        data-testid="input-confirm-password"
                        type="password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        className="h-12"
                        required
                      />
                    </div>
                    {registerData.password !== registerData.confirmPassword && registerData.confirmPassword && (
                      <p className="text-sm text-red-600">Passwords do not match</p>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg" 
                      data-testid="button-register"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating account..." : "Join Platform"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Multi-tenant platform supporting enterprise-grade security and compliance
          </p>
        </div>
      </div>
    </div>
  );
}