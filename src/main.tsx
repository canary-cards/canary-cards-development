import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@fontsource/righteous/400.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { getPostHogKey, getPostHogHost, isProduction } from './lib/environment'

// Only initialize PostHog in production
if (isProduction()) {
  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    autocapture: true,
    debug: true,
    capture_pageview: true,
    loaded: (posthog) => {
      console.log('PostHog loaded successfully', posthog);
      console.log('PostHog config:', {
        key: getPostHogKey(),
        host: getPostHogHost(),
        distinct_id: posthog.get_distinct_id()
      });
    }
  })
  console.log('PostHog initialized for production environment');
} else {
  console.log('PostHog skipped for non-production environment');
}

createRoot(document.getElementById("root")!).render(
  isProduction() ? (
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  ) : (
    <App />
  )
);
