import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, PostcardData } from '../types';

type AppAction = 
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_POSTCARD_DATA'; payload: Partial<PostcardData> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' }
  | { type: 'RESET_TO_HOME' }
  | { type: 'RESTORE_STATE'; payload: AppState }
  | { type: 'SET_RESTORING'; payload: boolean }
  | { type: 'SET_PAYMENT_LOADING'; payload: boolean };

const initialState: AppState = {
  currentStep: 1, // Start at landing screen instead of 0
  postcardData: {},
  isLoading: false,
  error: null,
  isRestoring: false, // Start with false since we no longer auto-restore
  isPaymentLoading: false, // Track global payment loading state
};

function appReducer(state: AppState, action: AppAction): AppState {
  let newState: AppState;
  
  switch (action.type) {
    case 'SET_STEP':
      newState = { ...state, currentStep: action.payload };
      break;
    case 'UPDATE_POSTCARD_DATA':
      newState = { 
        ...state, 
        postcardData: { ...state.postcardData, ...action.payload }
      };
      break;
    case 'SET_LOADING':
      newState = { ...state, isLoading: action.payload };
      break;
    case 'SET_ERROR':
      newState = { ...state, error: action.payload };
      break;
    case 'RESET_STATE':
      newState = initialState;
      break;
    case 'RESET_TO_HOME':
      // Clear all cached data and reset to step 1 (landing screen)
      console.log('🏠 Resetting to home - clearing all cached data');
      try {
        sessionStorage.removeItem('appContextBackup');
        localStorage.removeItem('postcardData');
        console.log('🧹 Cleared all cached data');
      } catch (error) {
        console.error('Failed to clear cached data:', error);
      }
      newState = { 
        currentStep: 1, 
        postcardData: {}, 
        isLoading: false, 
        error: null, 
        isRestoring: false,
        isPaymentLoading: false
      };
      break;
    case 'RESTORE_STATE':
      newState = { ...action.payload, isRestoring: false };
      break;
    case 'SET_RESTORING':
      newState = { ...state, isRestoring: action.payload };
      break;
    case 'SET_PAYMENT_LOADING':
      newState = { ...state, isPaymentLoading: action.payload };
      break;
    default:
      newState = state;
  }
  
  // Auto-backup to sessionStorage whenever postcard data changes
  if (action.type === 'UPDATE_POSTCARD_DATA' || action.type === 'RESTORE_STATE') {
    try {
      console.log('🔄 Auto-backing up state to sessionStorage:', newState.postcardData);
      sessionStorage.setItem('appContextBackup', JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to backup to sessionStorage:', error);
    }
  }
  
  return newState;
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Only restore state when explicitly requested (like payment return flow)
  React.useEffect(() => {
    // For now, we'll start fresh on every app load to prevent unwanted jumps
    // State restoration is only used in specific flows like payment return
    console.log('🏠 App starting fresh - no automatic state restoration');
    dispatch({ type: 'SET_RESTORING', payload: false });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Helper function for payment return flow to restore state
export function restoreStateFromStorage(dispatch: React.Dispatch<AppAction>): boolean {
  console.log('🔍 Payment return: attempting to restore state from storage...');
  
  // Validation function
  const validateRestoredState = (data: any): boolean => {
    console.log('🔍 Validating restored state:', data);
    
    if (!data || typeof data !== 'object') {
      console.log('❌ Invalid state: not an object');
      return false;
    }
    
    if (!data.postcardData) {
      console.log('❌ Invalid state: missing postcardData');
      return false;
    }
    
    const { postcardData } = data;
    
    // Check required fields
    if (!postcardData.userInfo?.fullName) {
      console.log('❌ Invalid state: missing userInfo.fullName');
      return false;
    }
    
    if (!postcardData.userInfo?.streetAddress) {
      console.log('❌ Invalid state: missing userInfo.streetAddress');
      return false;
    }
    
    if (!postcardData.representative?.name) {
      console.log('❌ Invalid state: missing representative.name');
      return false;
    }
    
    if (!postcardData.finalMessage) {
      console.log('❌ Invalid state: missing finalMessage');
      return false;
    }
    
    console.log('✅ State validation passed');
    return true;
  };

  // First try sessionStorage (primary)
  try {
    const sessionData = sessionStorage.getItem('appContextBackup');
    if (sessionData) {
      const parsedSessionData = JSON.parse(sessionData);
      console.log('✅ Found sessionStorage data:', parsedSessionData);
      
      if (validateRestoredState(parsedSessionData)) {
        console.log('✅ Restoring from sessionStorage');
        dispatch({ type: 'RESTORE_STATE', payload: parsedSessionData });
        return true;
      }
    }
  } catch (error) {
    console.error('❌ Failed to restore from sessionStorage:', error);
  }
  
  // Fallback to localStorage
  try {
    const localData = localStorage.getItem('postcardData');
    if (localData) {
      const parsedLocalData = JSON.parse(localData);
      console.log('🔄 Found localStorage data, migrating:', parsedLocalData);
      
      // Convert localStorage format to AppState format
      const migratedState: AppState = {
        currentStep: 5, // Assume we're at checkout step
        postcardData: parsedLocalData,
        isLoading: false,
        error: null,
        isRestoring: false,
        isPaymentLoading: false
      };
      
      if (validateRestoredState(migratedState)) {
        console.log('✅ Restoring from localStorage (migrated)');
        dispatch({ type: 'RESTORE_STATE', payload: migratedState });
        
        // Clean up old localStorage after successful migration
        localStorage.removeItem('postcardData');
        console.log('🧹 Cleaned up old localStorage data');
        return true;
      }
    }
  } catch (error) {
    console.error('❌ Failed to restore from localStorage:', error);
  }
  
  console.log('ℹ️ No valid data found in storage for payment return');
  return false;
}