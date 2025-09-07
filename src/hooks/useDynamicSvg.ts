import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache for SVG URLs to avoid repeated API calls
const urlCache = new Map<string, string>();

export const useDynamicSvg = (assetName: string) => {
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSvgAsset = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first for instant loading
        if (urlCache.has(assetName)) {
          setSvgUrl(urlCache.get(assetName)!);
          setLoading(false);
          return;
        }

        // First, get the asset metadata from the database
        const { data: asset, error: dbError } = await supabase
          .from('svg_assets')
          .select('file_path')
          .eq('name', assetName)
          .single();

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            setError(`SVG asset "${assetName}" not found`);
          } else {
            throw dbError;
          }
          return;
        }

        // Get the public URL for the SVG
        const { data } = supabase.storage
          .from('svg-assets')
          .getPublicUrl(asset.file_path);

        // Cache the URL for future use
        urlCache.set(assetName, data.publicUrl);
        setSvgUrl(data.publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load SVG asset');
      } finally {
        setLoading(false);
      }
    };

    if (assetName) {
      fetchSvgAsset();
    } else {
      setLoading(false);
      setSvgUrl(null);
    }
  }, [assetName]);

  return { svgUrl, loading, error };
};