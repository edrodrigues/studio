"use client";

import { useEffect, useRef } from "react";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, getRedirectResult } from "firebase/auth";

export default function AuthRedirectHandlerPage() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function init() {
      if (!getApps().length) initializeApp(firebaseConfig);
      const auth = getAuth();
      const path = window.location.pathname;

      if (path.endsWith("/handler")) {
        try {
          await getRedirectResult(auth);
        } catch (e) {
          console.error("Auth redirect error:", e);
        }
        window.location.replace("/auth");
      }
    }

    init();
  }, []);

  return null;
}
