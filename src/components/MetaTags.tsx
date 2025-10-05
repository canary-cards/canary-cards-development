import { Helmet, HelmetProvider } from 'react-helmet-async';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_TITLE = 'Send a handwritten postcard to Congress.';
const DEFAULT_DESCRIPTION = 'Just a few handwritten postcards can swing a congressional vote';
const DEFAULT_IMAGE = 'https://canary.cards/lovable-uploads/new_icon_for_preview.png';
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
      <meta property="og:site_name" content="Canary Cards" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Canary Cards - Send handwritten postcards to Congress" />
      
      {/* Twitter Card tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@canarycards" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content="Canary Cards - Send handwritten postcards to Congress" />
    </Helmet>
  );
};