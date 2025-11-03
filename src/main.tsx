import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@fontsource/patrick-hand/400.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { getPostHogKey, getPostHogHost, isProduction } from './lib/environment'
import { MetaTagsProvider } from './components/MetaTags'

// Only initialize PostHog in production
if (isProduction()) {
  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    person_profiles: 'always',
    autocapture: {
      // Capture standard DOM events
      dom_event_allowlist: ['click', 'change', 'submit'],
      
      // Capture these element types
      element_allowlist: ['button', 'a', 'input', 'select', 'textarea', 'label'],
      
      // Also capture any element with data-attr attribute
      css_selector_allowlist: ['[data-attr]'],
      
      // KEY FIX: Don't ignore any attributes - this ensures data-attr is captured
      element_attribute_ignorelist: [],
    },
    // Ensure custom properties aren't blocked
    property_denylist: [],
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
      <MetaTagsProvider>
        <App />
      </MetaTagsProvider>
    </PostHogProvider>
  ) : (
    <MetaTagsProvider>
      <App />
    </MetaTagsProvider>
  )
);
