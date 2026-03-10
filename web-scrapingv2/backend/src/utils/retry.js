import logger from './logger.js';

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
      const actualDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;
      
      logger.warn('Retry attempt', {
        attempt: attempt + 1,
        maxRetries,
        delay: actualDelay,
        error: error.message
      });
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }
  
  throw lastError;
}
