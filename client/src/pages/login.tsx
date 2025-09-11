import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Eye, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginData.username, loginData.password);
      toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
      setLocation('/');
    } catch (error) {
      toast({ 
        title: 'Login failed', 
        description: 'Invalid username or password.',
        variant: 'destructive' 
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(registerData);
      toast({ title: 'Account created!', description: 'Welcome to PENNY Security Network.' });
      setLocation('/');
    } catch (error) {
      toast({ 
        title: 'Registration failed', 
        description: 'Username may already exist or invalid data.',
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">PENNY Security Network</h1>
          <p className="text-slate-400">Secure access to your monitoring system</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-center">Access Control</CardTitle>
            <CardDescription className="text-slate-400 text-center">
              Sign in to your security command center
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger value="login" className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-slate-300">Username</Label>
                    <Input
                      id="login-username"
                      data-testid="input-login-username"
                      type="text"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Enter your username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-300">Password</Label>
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Enter your password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    data-testid="button-login"
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-slate-300">Username</Label>
                    <Input
                      id="register-username"
                      data-testid="input-register-username"
                      type="text"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Choose a username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-slate-300">Email</Label>
                    <Input
                      id="register-email"
                      data-testid="input-register-email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstName" className="text-slate-300">First Name</Label>
                      <Input
                        id="register-firstName"
                        data-testid="input-register-firstname"
                        type="text"
                        value={registerData.firstName}
                        onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-lastName" className="text-slate-300">Last Name</Label>
                      <Input
                        id="register-lastName"
                        data-testid="input-register-lastname"
                        type="text"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-slate-300">Password</Label>
                    <Input
                      id="register-password"
                      data-testid="input-register-password"
                      type="password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Create a secure password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    data-testid="button-register"
                    className="w-full bg-green-600 hover:bg-green-700" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-center space-x-6 text-xs text-slate-400">
                <div className="flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>Live Monitoring</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Network className="h-3 w-3" />
                  <span>Cross-Store Intel</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Secure Access</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}