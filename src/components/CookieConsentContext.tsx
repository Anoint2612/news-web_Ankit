'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type CookieConsentContextType = {
    consentGiven: boolean;
    setConsentGiven: (val: boolean) => void;
};

const CookieConsentContext = createContext<CookieConsentContextType>({
    consentGiven: false,
    setConsentGiven: () => {},
});

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
    const [consentGiven, setConsentGiven] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const consent = localStorage.getItem('cookie_consent');
            if (consent === 'accepted') {
                setConsentGiven(true);
            }
        }
    }, []);

    return (
        <CookieConsentContext.Provider value={{ consentGiven, setConsentGiven }}>
            {children}
        </CookieConsentContext.Provider>
    );
}

export const useCookieConsent = () => useContext(CookieConsentContext);
