import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, User, AlertTriangle, DollarSign, Calendar } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOffenderSchema } from "@shared/schema";
import type { Offender } from "@shared/schema";
import { z } from "zod";

const formSchema = insertOffenderSchema.extend({
  riskLevel: z.enum(['low', 'medium', 'high', 'extreme'])
});

export default function Offenders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOffender, setSelectedOffender] = useState<Offender | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: offenders = [] } = useQuery({
    queryKey: ['/api/offenders'],
    queryFn: () => fetch('/api/offenders?limit=100').then(res => res.json())
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['/api/offenders/search', searchQuery],
    queryFn: () => 
      searchQuery ? fetch(`/api/offenders?search=${encodeURIComponent(searchQuery)}`).then(res => res.json()) : [],
    enabled: searchQuery.length > 0
  });

  const createOffenderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch('/api/offenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create offender');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/offenders'] });
      setIsAddDialogOpen(false);
      form.reset();
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      physicalDescription: '',
      riskLevel: 'medium',
      notes: '',
      aliases: [],
      totalDebt: '0.00'
    }
  });

  const displayedOffenders = searchQuery ? searchResults : offenders;

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'extreme': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createOffenderMutation.mutate(data);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Offender Database"
          subtitle="Manage known offenders and track cross-store intelligence"
          alertCount={0}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Offenders</p>
                    <p className="text-2xl font-bold">{offenders.length}</p>
                  </div>
                  <User className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High Risk</p>
                    <p className="text-2xl font-bold text-orange-500">
                      {offenders.filter(o => o.riskLevel === 'high' || o.riskLevel === 'extreme').length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Debt</p>
                    <p className="text-2xl font-bold text-red-500">
                      ${offenders.reduce((sum, o) => sum + parseFloat(o.totalDebt || '0'), 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Recent Activity</p>
                    <p className="text-2xl font-bold text-blue-500">
                      {offenders.filter(o => 
                        o.lastSeenAt && 
                        new Date(o.lastSeenAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-xl">Offender Management</CardTitle>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search offenders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="input-search-offenders"
                    />
                  </div>
                  
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-offender">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Offender
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Offender</DialogTitle>
                      </DialogHeader>
                      
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-first-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-last-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name="physicalDescription"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Physical Description</FormLabel>
                                <FormControl>
                                  <Textarea {...field} data-testid="textarea-description" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="riskLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Risk Level</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-risk-level">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="extreme">Extreme</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                  <Textarea {...field} data-testid="textarea-notes" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createOffenderMutation.isPending}
                              data-testid="button-submit-offender"
                            >
                              {createOffenderMutation.isPending ? 'Adding...' : 'Add Offender'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedOffenders.map((offender) => (
                  <Card 
                    key={offender.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedOffender(offender)}
                    data-testid={`offender-card-${offender.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={offender.photoUrl || undefined} />
                          <AvatarFallback className="bg-muted">
                            {(offender.firstName?.[0] || '') + (offender.lastName?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-foreground">
                                {offender.firstName} {offender.lastName}
                              </h3>
                              {offender.aliases && offender.aliases.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  aka: {offender.aliases.join(', ')}
                                </p>
                              )}
                            </div>
                            <Badge className={getRiskLevelColor(offender.riskLevel || 'medium')}>
                              {offender.riskLevel}
                            </Badge>
                          </div>
                          
                          <div className="mt-2 space-y-1">
                            {parseFloat(offender.totalDebt || '0') > 0 && (
                              <p className="text-sm text-red-500 font-medium">
                                Debt: ${parseFloat(offender.totalDebt || '0').toLocaleString()}
                              </p>
                            )}
                            
                            {offender.lastSeenAt && (
                              <p className="text-xs text-muted-foreground">
                                Last seen: {new Date(offender.lastSeenAt).toLocaleDateString()}
                              </p>
                            )}
                            
                            {offender.physicalDescription && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {offender.physicalDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {displayedOffenders.length === 0 && (
                <div className="text-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No offenders found matching your search.' : 'No offenders in database.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Offender Detail Modal */}
      {selectedOffender && (
        <Dialog open={!!selectedOffender} onOpenChange={() => setSelectedOffender(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Offender Details</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarImage src={selectedOffender.photoUrl || undefined} />
                    <AvatarFallback className="bg-muted text-2xl">
                      {(selectedOffender.firstName?.[0] || '') + (selectedOffender.lastName?.[0] || '')}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-semibold">
                    {selectedOffender.firstName} {selectedOffender.lastName}
                  </h3>
                  <Badge className={getRiskLevelColor(selectedOffender.riskLevel || 'medium')}>
                    {selectedOffender.riskLevel} Risk
                  </Badge>
                </div>
                
                {parseFloat(selectedOffender.totalDebt || '0') > 0 && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-red-600">Outstanding Debt</p>
                      <p className="text-2xl font-bold text-red-700">
                        ${parseFloat(selectedOffender.totalDebt || '0').toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Personal Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedOffender.aliases && selectedOffender.aliases.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Aliases:</span>
                        <span className="ml-2">{selectedOffender.aliases.join(', ')}</span>
                      </div>
                    )}
                    {selectedOffender.physicalDescription && (
                      <div>
                        <span className="text-muted-foreground">Description:</span>
                        <p className="mt-1">{selectedOffender.physicalDescription}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Activity History</h4>
                  <div className="space-y-2 text-sm">
                    {selectedOffender.lastSeenAt && (
                      <div>
                        <span className="text-muted-foreground">Last Seen:</span>
                        <span className="ml-2">{new Date(selectedOffender.lastSeenAt).toLocaleString()}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Added:</span>
                      <span className="ml-2">{new Date(selectedOffender.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                {selectedOffender.notes && (
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm bg-muted p-3 rounded-md">{selectedOffender.notes}</p>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" data-testid="button-edit-offender">
                    Edit Details
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-view-incidents">
                    View Incidents
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-cross-store-intel">
                    Network Intel
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
