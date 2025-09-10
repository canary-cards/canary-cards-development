import React from 'react';
import { DynamicSvg } from './DynamicSvg';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <DynamicSvg 
      assetName="logo.svg"
      alt="Canary Cards" 
      className={className}
    />
  );
}