import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SvgAsset {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  created_at: string;
  updated_at: string;
}

export const useSvgAssets = () => {
  const [svgAssets, setSvgAssets] = useState<SvgAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSvgAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('svg_assets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSvgAssets(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SVG assets');
    } finally {
      setLoading(false);
    }
  };

  const getSvgUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('svg-assets')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  const uploadSvg = async (file: File, filePath: string, name: string, description?: string) => {
    try {
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('svg-assets')
        .upload(filePath, file, {
          upsert: true,
          contentType: 'image/svg+xml'
        });

      if (uploadError) throw uploadError;

      // Update or insert metadata
      const { error: dbError } = await supabase
        .from('svg_assets')
        .upsert({
          name,
          description: description || null,
          file_path: filePath
        }, {
          onConflict: 'name'
        });

      if (dbError) throw dbError;

      // Refresh the list
      await fetchSvgAssets();
      
      return getSvgUrl(filePath);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to upload SVG');
    }
  };

  const deleteSvg = async (name: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('svg-assets')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('svg_assets')
        .delete()
        .eq('name', name);

      if (dbError) throw dbError;

      // Refresh the list
      await fetchSvgAssets();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete SVG');
    }
  };

  useEffect(() => {
    fetchSvgAssets();
  }, []);

  return {
    svgAssets,
    loading,
    error,
    getSvgUrl,
    uploadSvg,
    deleteSvg,
    refetch: fetchSvgAssets
  };
};