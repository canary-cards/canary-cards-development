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
      className={`cursor-pointer transition-all duration-200 bg-card border border-border shadow-sm relative ${
        isSelected 
          ? 'ring-2 ring-primary bg-card border-primary shadow-md' 
          : 'hover:shadow-md border-border/60'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={onClick}
    >
      <CardContent className={`${isCompact ? 'p-3' : 'p-6'}`}>
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
            <img 
              src={representative.photo} 
              alt={representative.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          </div>
          <div className="flex-grow min-w-0">
            <h3 className="text-primary font-semibold text-lg mb-1">
              {representative.name}
            </h3>
            <p className="text-muted-foreground text-sm mb-2">
              {representative.district} • {representative.city}, {representative.state}
            </p>
            {showBadge && isSelected && (
              <Badge variant="default" className="mb-3 bg-amber-400 text-amber-900 hover:bg-amber-400">
                My Rep
              </Badge>
            )}
            {representative.bio && isSelected && (
              <p className="text-sm text-foreground leading-relaxed">
                {representative.bio}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}