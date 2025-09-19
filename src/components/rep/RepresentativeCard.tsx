import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Representative } from '@/types';

interface RepresentativeCardProps {
  representative: Representative;
  isSelected?: boolean;
  showBadge?: boolean;
  density?: 'compact' | 'normal';
  onClick?: () => void;
}

export function RepresentativeCard({ 
  representative, 
  isSelected = false, 
  showBadge = false,
  density = 'normal',
  onClick 
}: RepresentativeCardProps) {
  const isCompact = density === 'compact';
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 bg-card border shadow-sm relative ${
        isSelected 
          ? 'border-2 border-primary shadow-md' 
          : 'border-border hover:shadow-md hover:border-primary/50'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
    >
      <CardContent className={`${isCompact ? 'p-3' : 'p-6'}`}>
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="relative w-[100px] h-[100px] rounded-lg bg-muted flex-shrink-0">
              <img 
                src={representative.photo} 
                alt={representative.name}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="text-primary font-semibold text-lg mb-1">
                {representative.name}
              </h3>
              <p className="text-muted-foreground text-sm mb-2 leading-tight">
                {representative.district} • {representative.city}, {representative.state}
              </p>
              {showBadge && isSelected && (
                <Badge variant="default" className="text-xs px-2 py-0.5 bg-amber-400 text-primary hover:bg-amber-400 shadow-sm whitespace-nowrap">
                  My Rep
                </Badge>
              )}
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}