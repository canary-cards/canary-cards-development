import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';

export default function ShareTest() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || 'direct';
  
  console.log('ShareTest page loaded with ref:', ref);
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Share Test Page</h1>
        <p>Ref: {ref}</p>
        <p>This is a simple test page to verify routing works.</p>
      </div>
    </div>
  );
}