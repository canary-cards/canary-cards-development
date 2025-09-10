interface DynamicSvgProps {
  assetName: string;
  fallbackSrc?: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}

// Load all SVG assets using Vite's glob import
const svgAssets = import.meta.glob('/src/assets/**/*.svg', { 
  eager: true, 
  as: 'url' 
}) as Record<string, string>;

// Create a mapping from asset names to URLs
const getAssetUrl = (assetName: string): string | null => {
  // Direct filename match
  const directMatch = Object.entries(svgAssets).find(([path]) => 
    path.includes(`/${assetName}`)
  );
  if (directMatch) return directMatch[1];


  return null;
};

export const DynamicSvg = ({ 
  assetName, 
  fallbackSrc, 
  className, 
  alt, 
  width, 
  height 
}: DynamicSvgProps) => {
  const assetUrl = getAssetUrl(assetName);
  const src = assetUrl || fallbackSrc;

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