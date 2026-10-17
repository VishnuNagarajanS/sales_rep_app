import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface DirtyEntry {
  id: string;
  isDirty: boolean;
  message?: string;
}

interface NavigationGuardContextType {
  isDirty: boolean;
  dirtyMessage: string | null;
  registerDirty: (id: string, isDirty: boolean, message?: string) => void;
  clearDirty: (id?: string) => void;
  confirmNavigation: (proceedCallback: () => void) => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined);

export const NavigationGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dirtyMap, setDirtyMap] = useState<Record<string, DirtyEntry>>({});
  const dirtyMapRef = useRef(dirtyMap);
  dirtyMapRef.current = dirtyMap;

  // Derive whether any form or workflow is currently dirty
  const dirtyEntries = Object.values(dirtyMap).filter(entry => entry.isDirty);
  const isDirty = dirtyEntries.length > 0;
  const dirtyMessage = dirtyEntries[0]?.message || 'You have unsaved changes. Are you sure you want to leave this page?';

  const registerDirty = useCallback((id: string, dirty: boolean, message?: string) => {
    setDirtyMap(prev => {
      if (!dirty && !prev[id]) return prev;
      if (!dirty) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return {
        ...prev,
        [id]: { id, isDirty: true, message },
      };
    });
  }, []);

  const clearDirty = useCallback((id?: string) => {
    if (id) {
      setDirtyMap(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setDirtyMap({});
    }
  }, []);

  // Window/Tab close or reload beforeunload protection
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for modern browsers (Chrome, Edge, Firefox, Safari)
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const confirmNavigation = useCallback((proceedCallback: () => void): boolean => {
    const activeEntries = Object.values(dirtyMapRef.current).filter(entry => entry.isDirty);
    if (activeEntries.length === 0) {
      proceedCallback();
      return true;
    }

    const msg = activeEntries[0]?.message ||
      'You have unsaved changes. If you leave this page, your changes will be discarded. Are you sure you want to leave?';

    const confirmed = window.confirm(msg);
    if (confirmed) {
      setDirtyMap({});
      proceedCallback();
      return true;
    }
    return false;
  }, []);

  return (
    <NavigationGuardContext.Provider
      value={{
        isDirty,
        dirtyMessage,
        registerDirty,
        clearDirty,
        confirmNavigation,
      }}
    >
      {children}
    </NavigationGuardContext.Provider>
  );
};

export const useNavigationGuard = () => {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }
  return context;
};

/**
 * Hook to automatically register an unsaved/dirty state from any form or component.
 * Automatically unregisters when the component unmounts.
 */
export const useUnsavedChanges = (isDirty: boolean, message?: string, customId?: string) => {
  const { registerDirty, clearDirty } = useNavigationGuard();
  const idRef = useRef<string>(customId || `form-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    registerDirty(idRef.current, isDirty, message);
  }, [isDirty, message, registerDirty]);

  useEffect(() => {
    const id = idRef.current;
    return () => {
      clearDirty(id);
    };
  }, [clearDirty]);
};
