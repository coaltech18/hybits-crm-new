// ============================================================================
// LOGGER - Centralized logging wrapper
// ============================================================================

const NODE_ENV = process.env.NODE_ENV || 'development';
const debugEnabled = NODE_ENV !== 'production';

export const logger = {
  debug: (...args: any[]) => { 
    if (debugEnabled) console.debug('[debug]', ...args); 
  },
  info: (...args: any[]) => { 
    console.info('[info]', ...args); 
  },
  warn: (...args: any[]) => { 
    console.warn('[warn]', ...args); 
  },
  error: (...args: any[]) => { 
    console.error('[error]', ...args); 
  },
};

export default logger;

