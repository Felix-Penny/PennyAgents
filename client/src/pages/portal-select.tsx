import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Store, CreditCard } from "lucide-react";
import { Link } from "wouter";

export default function PortalSelectPage() {
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
              <Link href="/penny/login">
                <Button className="w-full" data-testid="button-penny-login">
                  Access Penny Portal
                </Button>
              </Link>
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
              <Link href="/store/login">
                <Button className="w-full" variant="outline" data-testid="button-store-login">
                  Access Store Portal
                </Button>
              </Link>
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
              <Link href="/repayment/login">
                <Button className="w-full" variant="secondary" data-testid="button-repayment-login">
                  Access Repayment Portal
                </Button>
              </Link>
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