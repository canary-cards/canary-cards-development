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
    
    // Session Replay - captures user interactions for debugging
    session_recording: {
      recordCrossOriginIframes: true,
      maskAllInputs: true, // Protect PII
      maskTextSelector: '[data-mask]', // Custom masking
    },
    
    // Autocapture configuration
    autocapture: {
      dom_event_allowlist: ['click', 'change', 'submit'],
      element_allowlist: ['button', 'a', 'input', 'select', 'textarea', 'label'],
      css_selector_allowlist: ['[data-attr]'],
      element_attribute_ignorelist: [],
    },
    
    // Performance monitoring
    capture_performance: true,
    
    // Ensure custom properties aren't blocked
    property_denylist: [],
    
    // Debug mode (consider disabling in production)
    debug: false,
    
    // Auto page view tracking
    capture_pageview: true,
    
    loaded: (posthog) => {
      console.log('PostHog initialized with enhanced tracking');
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
