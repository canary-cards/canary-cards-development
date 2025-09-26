import { Helmet, HelmetProvider } from 'react-helmet-async';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_TITLE = 'Send a handwritten postcard to Congress.';
const DEFAULT_DESCRIPTION = 'Just 50 cards can swing a vote. Canary makes it effortless.';
const DEFAULT_IMAGE = 'https://canary.cards/lovable-uploads/2948adc2-939c-491e-9cb1-fe66e5ce4920.png';
const DEFAULT_URL = 'https://canary.cards';

export const MetaTagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

export const MetaTags: React.FC<MetaTagsProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url = DEFAULT_URL,
}) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      
      {/* Twitter Card tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};