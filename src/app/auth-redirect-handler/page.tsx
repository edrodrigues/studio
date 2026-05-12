"use client";

import { useEffect } from "react";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, getRedirectResult } from "firebase/auth";

export default function AuthRedirectHandlerPage() {
  useEffect(() => {
    async function handleRedirect() {
      try {
        if (!getApps().length) initializeApp(firebaseConfig);
        const auth = getAuth();
        await getRedirectResult(auth);
      } catch (e) {
        console.error("Auth redirect error:", e);
      }
      window.location.replace("/auth");
    }
    handleRedirect();
  }, []);

  return null;
}
