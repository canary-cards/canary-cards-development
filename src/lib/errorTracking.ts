import posthog from 'posthog-js';

/**
 * Centralized error tracking helper for edge function errors
 * Captures errors with context and sends to PostHog
 */
export const captureEdgeFunctionError = (
  error: any,
  functionName: string,
  context?: {
    email?: string;
    zipCode?: string;
    representative?: string;
    sendOption?: string;
    step?: string;
    [key: string]: any;
  }
) => {
  // Only capture in production when PostHog is initialized
  if (typeof window === 'undefined' || !posthog.__loaded) {
    console.error(`[${functionName}] Error:`, error, context);
    return;
  }

  // Extract error details
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const statusCode = error?.status || error?.statusCode || null;
  const errorName = error?.name || 'EdgeFunctionError';

  // Capture exception with PostHog
  posthog.captureException(error, {
    tags: {
      source: 'edge_function',
      function: functionName,
      ...(statusCode && { statusCode: statusCode.toString() })
    },
    extra: {
      functionName,
      errorMessage,
      errorName,
      statusCode,
      ...context
    }
  });

  console.error(`[${functionName}] Error:`, {
    error,
    context,
    errorMessage,
    statusCode
  });
};
