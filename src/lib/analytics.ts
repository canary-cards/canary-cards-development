import posthog from 'posthog-js';

/**
 * Centralized analytics tracking utility for PostHog
 * Provides type-safe event tracking across the entire user journey
 */

// User Journey Events
export const trackZipCodeEntered = (zipCode: string) => {
  posthog.capture('zip_code_entered', {
    zip_code: zipCode,
  });
};

export const trackRepresentativeSelected = (rep: {
  name: string;
  party: string;
  chamber: string;
  state: string;
}) => {
  posthog.capture('representative_selected', {
    rep_name: rep.name,
    rep_party: rep.party,
    rep_chamber: rep.chamber,
    rep_state: rep.state,
  });
};

export const trackAddressEntered = (addressData: {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}) => {
  posthog.capture('address_entered', {
    city: addressData.city,
    state: addressData.state,
    zip_code: addressData.zipCode,
  });
};

export const trackMessageDraftStarted = (topicType: string) => {
  posthog.capture('message_draft_started', {
    topic_type: topicType,
  });
};

export const trackMessageDraftCompleted = (messageLength: number, duration: number) => {
  posthog.capture('message_draft_completed', {
    message_length: messageLength,
    draft_duration_seconds: duration,
  });
};

export const trackMessageEdited = () => {
  posthog.capture('message_edited');
};

export const trackReviewCardViewed = () => {
  posthog.capture('review_card_viewed');
};

export const trackCheckoutStarted = (price: number) => {
  posthog.capture('checkout_started', {
    price_cents: price,
  });
};

export const trackPaymentCompleted = (orderId: string, price: number) => {
  posthog.capture('payment_completed', {
    order_id: orderId,
    price_cents: price,
    value: price / 100, // For revenue tracking
  });
};

export const trackPaymentFailed = (error: string) => {
  posthog.capture('payment_failed', {
    error_message: error,
  });
};

export const trackShareInitiated = (orderId: string) => {
  posthog.capture('share_initiated', {
    order_id: orderId,
  });
};

export const trackShareCompleted = (method: 'copy' | 'native') => {
  posthog.capture('share_completed', {
    share_method: method,
  });
};

export const trackReferralUsed = (referrerOrderId: string) => {
  posthog.capture('referral_used', {
    referrer_order_id: referrerOrderId,
  });
};

// User Identification
export const identifyUser = (email: string, properties?: {
  fullName?: string;
  zipCode?: string;
  state?: string;
  city?: string;
}) => {
  posthog.identify(email, {
    email,
    ...properties,
  });
};

// Set user properties (can be called multiple times as user progresses)
export const setUserProperties = (properties: {
  zipCode?: string;
  state?: string;
  city?: string;
  fullName?: string;
  representativeName?: string;
  representativeParty?: string;
  representativeChamber?: string;
}) => {
  posthog.people.set(properties);
};

// Error Tracking
export const trackError = (
  error: any,
  context: string,
  additionalData?: Record<string, any>
) => {
  posthog.captureException(error, {
    tags: {
      source: 'frontend',
      context,
    },
    extra: {
      ...additionalData,
      errorMessage: error?.message || String(error),
      errorName: error?.name || 'Error',
    },
  });
};

// API Performance Tracking
export const trackAPICall = (
  endpoint: string,
  duration: number,
  success: boolean,
  statusCode?: number
) => {
  posthog.capture('api_call', {
    endpoint,
    duration_ms: duration,
    success,
    status_code: statusCode,
  });
};

// Feature Usage Tracking
export const trackFeatureUsed = (featureName: string, properties?: Record<string, any>) => {
  posthog.capture('feature_used', {
    feature: featureName,
    ...properties,
  });
};

// Navigation Tracking
export const trackPageView = (pageName: string, properties?: Record<string, any>) => {
  posthog.capture('page_viewed', {
    page: pageName,
    ...properties,
  });
};

// Engagement Tracking
export const trackTimeOnStep = (step: string, seconds: number) => {
  posthog.capture('step_time_spent', {
    step,
    seconds,
  });
};

export const trackButtonClick = (buttonName: string, location: string) => {
  posthog.capture('button_clicked', {
    button: buttonName,
    location,
  });
};

// Funnel Drop-off Tracking
export const trackFunnelAbandonment = (step: string, reason?: string) => {
  posthog.capture('funnel_abandoned', {
    step,
    reason,
  });
};
