import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { getPostHogKey, getPostHogHost } from './lib/environment'

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

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
