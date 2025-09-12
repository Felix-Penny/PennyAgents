import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, Store, CreditCard, ChevronDown, LogIn, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function PortalSelectPage() {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (credentials: { username: string; password: string }, portalType: string) => {
    try {
      const user = await loginMutation.mutateAsync(credentials);
      
      // Redirect based on portal type and user role
      let redirectPath = '/dashboard'; // default
      
      switch (portalType) {
        case 'penny':
          redirectPath = '/penny/dashboard';
          break;
        case 'store': 
          redirectPath = '/dashboard';
          break;
        case 'repayment':
          redirectPath = '/repayment/dashboard';
          break;
        default:
          // Fallback: redirect based on user role
          if (user.role === 'penny_admin') {
            redirectPath = '/penny/dashboard';
          } else if (user.role === 'offender') {
            redirectPath = '/repayment/dashboard';
          } else {
            redirectPath = '/dashboard';
          }
      }
      
      setLocation(redirectPath);
    } catch (error: any) {
      toast({
        title: "Login failed", 
        description: error.message || "Please check your credentials",
        variant: "destructive"
      });
    }
  };

  const LoginForm = ({ portalType, portalName }: { portalType: string; portalName: string }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    
    return (
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login"><LogIn className="w-4 h-4 mr-2" />Login</TabsTrigger>
          <TabsTrigger value="signup"><UserPlus className="w-4 h-4 mr-2" />Sign Up</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`username-${portalType}`}>Username</Label>
            <Input 
              id={`username-${portalType}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              data-testid={`input-username-${portalType}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`password-${portalType}`}>Password</Label>
            <Input 
              id={`password-${portalType}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              data-testid={`input-password-${portalType}`}
            />
          </div>
          <Button 
            className="w-full" 
            onClick={() => handleLogin({ username, password }, portalType)}
            disabled={loginMutation.isPending}
            data-testid={`button-login-${portalType}`}
          >
            {loginMutation.isPending ? "Logging in..." : `Access ${portalName} Portal`}
          </Button>
        </TabsContent>
        
        <TabsContent value="signup" className="space-y-4">
          <div className="text-center py-4">
            <p className="text-muted-foreground">Contact your system administrator to request access to the {portalName} portal.</p>
          </div>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" data-testid="text-page-title">PENNY Security System</h1>
          <p className="text-muted-foreground text-lg">Choose your portal to access the system</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Penny Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="card-penny-portal">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl">Penny Portal</CardTitle>
              <CardDescription>
                For Penny administrators and system managers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible 
                open={openPanel === 'penny'} 
                onOpenChange={(open) => setOpenPanel(open ? 'penny' : null)}
              >
                <CollapsibleTrigger asChild>
                  <Button className="w-full" data-testid="button-penny-login">
                    Access Penny Portal
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <LoginForm portalType="penny" portalName="Penny" />
                </CollapsibleContent>
              </Collapsible>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                System administration and multi-store management
              </p>
            </CardContent>
          </Card>

          {/* Store Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="card-store-portal">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Store className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">Store Portal</CardTitle>
              <CardDescription>
                For store staff and store managers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible 
                open={openPanel === 'store'} 
                onOpenChange={(open) => setOpenPanel(open ? 'store' : null)}
              >
                <CollapsibleTrigger asChild>
                  <Button className="w-full" variant="outline" data-testid="button-store-login">
                    Access Store Portal
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <LoginForm portalType="store" portalName="Store" />
                </CollapsibleContent>
              </Collapsible>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Daily security monitoring and store operations
              </p>
            </CardContent>
          </Card>

          {/* Repayment Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid="card-repayment-portal">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-xl">Repayment Portal</CardTitle>
              <CardDescription>
                For individuals making payments or restitution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible 
                open={openPanel === 'repayment'} 
                onOpenChange={(open) => setOpenPanel(open ? 'repayment' : null)}
              >
                <CollapsibleTrigger asChild>
                  <Button className="w-full" variant="secondary" data-testid="button-repayment-login">
                    Access Repayment Portal
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <LoginForm portalType="repayment" portalName="Repayment" />
                </CollapsibleContent>
              </Collapsible>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Payment processing and account management
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}