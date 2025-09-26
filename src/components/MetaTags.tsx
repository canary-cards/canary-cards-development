import { Helmet, HelmetProvider } from 'react-helmet-async';
import { getFrontendUrl } from '@/lib/environment';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const DEFAULT_TITLE = 'Send a handwritten postcard to Congress';
const DEFAULT_DESCRIPTION = 'Just 50 cards can swing a vote. Canary makes it effortless.';
const DEFAULT_IMAGE = '/lovable-uploads/2948adc2-939c-491e-9cb1-fe66e5ce4920.png';

export const MetaTagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

export const MetaTags: React.FC<MetaTagsProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website'
}) => {
  const frontendUrl = getFrontendUrl();
  const absoluteImage = image.startsWith('http') ? image : `${frontendUrl}${image}`;
  const absoluteUrl = url || frontendUrl;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={absoluteUrl} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </Helmet>
  );
};