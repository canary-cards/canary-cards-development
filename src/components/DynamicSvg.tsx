import { useDynamicSvg } from '@/hooks/useDynamicSvg';

interface DynamicSvgProps {
  assetName: string;
  fallbackSrc?: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export const DynamicSvg = ({ 
  assetName, 
  fallbackSrc, 
  className, 
  alt, 
  width, 
  height 
}: DynamicSvgProps) => {
  const { svgUrl, loading, error } = useDynamicSvg(assetName);

  if (loading) {
    return (
      <div 
        className={`relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30 rounded ${className}`} 
        style={{ width, height }}
      >
        {/* Skeleton shape that mimics icon appearance */}
        <div className="absolute inset-2 bg-gradient-to-br from-muted to-muted/80 rounded animate-pulse" />
        <div className="absolute inset-4 bg-gradient-to-tr from-muted/60 to-muted/40 rounded-full animate-pulse delay-75" />
      </div>
    );
  }

  // If there's an error or no SVG found, use fallback if provided
  const src = error || !svgUrl ? fallbackSrc : svgUrl;

  if (!src) {
    return (
      <div className={`bg-muted rounded flex items-center justify-center text-muted-foreground text-sm ${className}`} style={{ width, height }}>
        No image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || assetName}
      className={className}
      width={width}
      height={height}
      loading="eager"
      decoding="async"
      style={{ contentVisibility: 'auto' }}
    />
  );
};