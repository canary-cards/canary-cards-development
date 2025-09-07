// Safe storage utilities to prevent SSR/hydration issues
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
    }
    return null;
  },
  
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn(`Failed to set item in localStorage: ${key}`, error);
    }
  },
  
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
    }
  }
};