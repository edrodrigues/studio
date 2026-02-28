'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { useFirebase, useUser } from '@/firebase';

export interface UserPreferences {
  clientName: string;
  yourName: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  clientName: '',
  yourName: '',
};

export function useUserPreferences() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isUserLoading || !user) {
      setIsLoading(true);
      return;
    }

    const preferencesRef = doc(firestore!, 'users', user.uid, 'preferences', 'settings') as DocumentReference<UserPreferences>;

    const unsubscribe = onSnapshot(
      preferencesRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          setPreferences(snapshot.data() as UserPreferences);
        } else {
          setPreferences(DEFAULT_PREFERENCES);
        }
        setIsLoading(false);
      },
      () => {
        setPreferences(DEFAULT_PREFERENCES);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user, isUserLoading]);

  const setClientName = useCallback(async (value: string) => {
    if (!firestore || !user) return;
    setPreferences(prev => ({ ...prev, clientName: value }));
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid, 'preferences', 'settings'), 
        { clientName: value }, 
        { merge: true }
      );
    } finally {
      setIsSaving(false);
    }
  }, [firestore, user]);

  const setYourName = useCallback(async (value: string) => {
    if (!firestore || !user) return;
    setPreferences(prev => ({ ...prev, yourName: value }));
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid, 'preferences', 'settings'), 
        { yourName: value }, 
        { merge: true }
      );
    } finally {
      setIsSaving(false);
    }
  }, [firestore, user]);

  return {
    clientName: preferences.clientName,
    yourName: preferences.yourName,
    setClientName,
    setYourName,
    isLoading: isLoading || isUserLoading,
    isSaving,
  };
}
