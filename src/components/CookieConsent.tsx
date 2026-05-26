'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCookieConsent } from './CookieConsentContext';
import styles from './CookieConsent.module.css';

interface CookieConsentProps {
    onAccept?: () => void;
    onReject?: () => void;
}

export default function CookieConsent({ onAccept, onReject }: CookieConsentProps) {
    const { setConsentGiven } = useCookieConsent();
    const [isVisible, setIsVisible] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        // Check if consent has already been given
        const consent = localStorage.getItem('cookie_consent');
        if (!consent) {
            setIsVisible(true);
            // Slight delay ensures the initial render has translateY(100%) before we switch it to 0
            const timer = setTimeout(() => setHasMounted(true), 50);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie_consent', 'accepted');
        setConsentGiven(true);
        setHasMounted(false);
        // Wait for slide-out animation to finish before removing from DOM
        setTimeout(() => {
            setIsVisible(false);
            if (onAccept) onAccept();
        }, 500);
    };

    const handleReject = () => {
        localStorage.setItem('cookie_consent', 'rejected');
        setHasMounted(false);
        setTimeout(() => {
            setIsVisible(false);
            if (onReject) onReject();
        }, 500);
    };

    if (!isVisible) return null;

    return (
        <div className={`${styles.overlay} ${hasMounted ? styles.visible : styles.hidden}`}>
            <div className={styles.container}>
                <div className={styles.text}>
                    <p>
                        We use cookies to improve your browsing experience and analyze site traffic (including heatmaps and click tracking) to provide a better user experience. 
                        By clicking "Accept All", you consent to our use of cookies. 
                        Read our <Link href="/privacy-policy" className={styles.link}>Privacy Policy</Link> for more information.
                    </p>
                </div>
                
                <div className={styles.actions}>
                    <button onClick={handleReject} className={`${styles.btn} ${styles.btnReject}`}>
                        Reject
                    </button>
                    <button onClick={handleAccept} className={`${styles.btn} ${styles.btnAccept}`}>
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    );
}
