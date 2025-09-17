import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { getPostHogKey, getPostHogHost } from './lib/environment'

posthog.init(getPostHogKey(), {
  api_host: getPostHogHost(),
})

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
