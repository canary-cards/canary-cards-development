import { Helmet, HelmetProvider } from 'react-helmet-async';

interface MetaTagsProps {
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = 'Send a handwritten postcard to Congress';
const DEFAULT_DESCRIPTION = 'Just 50 cards can swing a vote. Canary makes it effortless.';

export const MetaTagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

export const MetaTags: React.FC<MetaTagsProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
};