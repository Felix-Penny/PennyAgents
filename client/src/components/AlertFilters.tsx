import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Camera, MapPin, Clock, Filter, X, RefreshCw } from "lucide-react";

export interface AlertFiltersData {
  severity?: string[];
  types?: string[];
  cameras?: string[];
  areas?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  status?: string[];
  assignedTo?: string[];
  search?: string;
}

export interface AlertFiltersProps {
  filters: AlertFiltersData;
  onFiltersChange: (filters: AlertFiltersData) => void;
  availableOptions?: {
    severities?: string[];
    types?: string[];
    cameras?: string[];
    areas?: string[];
    statuses?: string[];
    users?: Array<{ id: string; name: string }>;
  };
  isLoading?: boolean;
  resultsCount?: number;
}

export function AlertFilters({
  filters,
  onFiltersChange,
  availableOptions = {},
  isLoading = false,
  resultsCount
}: AlertFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  const defaultOptions = {
    severities: ["low", "medium", "high", "critical"],
    types: ["theft_in_progress", "known_offender_entry", "aggressive_behavior", "suspicious_activity", "unauthorized_access", "weapon_detected"],
    cameras: ["cam-001", "cam-002", "cam-003", "cam-004", "cam-005"],
    areas: ["Main Entrance", "Electronics Section", "Pharmacy", "Stockroom", "Checkout Area", "Parking Lot"],
    statuses: ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED", "ESCALATED"],
    users: []
  };

  const options = { ...defaultOptions, ...availableOptions };

  const handleSeverityChange = (severity: string, checked: boolean) => {
    const currentSeverities = filters.severity || [];
    const newSeverities = checked
      ? [...currentSeverities, severity]
      : currentSeverities.filter(s => s !== severity);
    
    onFiltersChange({
      ...filters,
      severity: newSeverities
    });
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    const currentTypes = filters.types || [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter(t => t !== type);
    
    onFiltersChange({
      ...filters,
      types: newTypes
    });
  };

  const handleCameraChange = (camera: string, checked: boolean) => {
    const currentCameras = filters.cameras || [];
    const newCameras = checked
      ? [...currentCameras, camera]
      : currentCameras.filter(c => c !== camera);
    
    onFiltersChange({
      ...filters,
      cameras: newCameras
    });
  };

  const handleAreaChange = (area: string, checked: boolean) => {
    const currentAreas = filters.areas || [];
    const newAreas = checked
      ? [...currentAreas, area]
      : currentAreas.filter(a => a !== area);
    
    onFiltersChange({
      ...filters,
      areas: newAreas
    });
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const currentStatuses = filters.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status);
    
    onFiltersChange({
      ...filters,
      status: newStatuses
    });
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    onFiltersChange({
      ...filters,
      search: search.trim() || undefined
    });
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof AlertFiltersData];
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  const getActiveFilterCount = () => {
    let count = 0;
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof AlertFiltersData];
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value) {
        count += 1;
      }
    });
    return count;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-3 w-3 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-3 w-3 text-orange-600" />;
      case "medium":
        return <Clock className="h-3 w-3 text-yellow-600" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-blue-600" />;
    }
  };

  const getTypeDisplay = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-lg">Alert Filters</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {resultsCount !== undefined && (
              <Badge variant="outline" className="text-sm">
                {resultsCount} results
              </Badge>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            {isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Alerts</Label>
          <Input
            id="search"
            placeholder="Search by title, message, or location..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <Separator />

        {/* Severity Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Severity
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {options.severities.map((severity) => (
              <div key={severity} className="flex items-center space-x-2">
                <Checkbox
                  id={`severity-${severity}`}
                  checked={filters.severity?.includes(severity) || false}
                  onCheckedChange={(checked) => handleSeverityChange(severity, checked as boolean)}
                  data-testid={`checkbox-severity-${severity}`}
                />
                <Label 
                  htmlFor={`severity-${severity}`} 
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  {getSeverityIcon(severity)}
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Alert Type Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Alert Types</Label>
          <div className="grid grid-cols-1 gap-2">
            {options.types.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.types?.includes(type) || false}
                  onCheckedChange={(checked) => handleTypeChange(type, checked as boolean)}
                  data-testid={`checkbox-type-${type}`}
                />
                <Label 
                  htmlFor={`type-${type}`} 
                  className="text-sm cursor-pointer"
                >
                  {getTypeDisplay(type)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Camera Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Cameras
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {options.cameras.map((camera) => (
              <div key={camera} className="flex items-center space-x-2">
                <Checkbox
                  id={`camera-${camera}`}
                  checked={filters.cameras?.includes(camera) || false}
                  onCheckedChange={(checked) => handleCameraChange(camera, checked as boolean)}
                  data-testid={`checkbox-camera-${camera}`}
                />
                <Label 
                  htmlFor={`camera-${camera}`} 
                  className="text-sm cursor-pointer"
                >
                  {camera}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Area Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Areas
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {options.areas.map((area) => (
              <div key={area} className="flex items-center space-x-2">
                <Checkbox
                  id={`area-${area}`}
                  checked={filters.areas?.includes(area) || false}
                  onCheckedChange={(checked) => handleAreaChange(area, checked as boolean)}
                  data-testid={`checkbox-area-${area}`}
                />
                <Label 
                  htmlFor={`area-${area}`} 
                  className="text-sm cursor-pointer"
                >
                  {area}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Status Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Status</Label>
          <div className="grid grid-cols-2 gap-2">
            {options.statuses.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={filters.status?.includes(status) || false}
                  onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
                  data-testid={`checkbox-status-${status}`}
                />
                <Label 
                  htmlFor={`status-${status}`} 
                  className="text-sm cursor-pointer"
                >
                  {status.replace(/_/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Filter Presets */}
        <Separator />
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quick Filters</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange({ severity: ["critical", "high"] })}
              data-testid="button-high-priority"
            >
              High Priority
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange({ status: ["OPEN", "IN_PROGRESS"] })}
              data-testid="button-active-alerts"
            >
              Active Alerts
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange({ 
                types: ["weapon_detected", "aggressive_behavior", "unauthorized_access"] 
              })}
              data-testid="button-security-threats"
            >
              Security Threats
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AlertFilters;