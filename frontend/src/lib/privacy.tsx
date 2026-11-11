"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "myfinance:privacy";

const listeners = new Set<() => void>();
let stored: boolean | null = null;

/** Reads the last choice once; localStorage may be unavailable (private mode, SSR). */
function readStored() {
    if (stored === null) {
        try {
            stored = window.localStorage.getItem(STORAGE_KEY) === "1";
        } catch {
            stored = false;
        }
    }
    return stored;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const getSnapshot = () => readStored();
/** Server and the first client render must agree, so the stored choice is applied after hydration. */
const getServerSnapshot = () => false;

type PrivacyContextValue = {
    /** True when values must be blurred */
    hidden: boolean;
    toggle: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue>({ hidden: false, toggle: () => undefined });

/** Global "eye" state: blurs every money value on screen while it is on. */
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
    const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // The attribute also lets pure CSS rules reach charts (axis labels and tooltips)
    useEffect(() => {
        document.documentElement.dataset.privacy = hidden ? "on" : "off";
    }, [hidden]);

    const toggle = useCallback(() => {
        const next = !readStored();
        stored = next;
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
            // ignore storage failures
        }
        listeners.forEach(listener => listener());
    }, []);

    return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
    return useContext(PrivacyContext);
}
