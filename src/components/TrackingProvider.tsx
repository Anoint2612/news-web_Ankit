'use client';

import { useSession as useNextAuthSession } from 'next-auth/react';
import { useSession as useHeatmapSession } from '@/hooks/useSession';
import { useHeatmapTracker } from '@/hooks/useHeatmapTracker';
import { useCookieConsent } from './CookieConsentContext';

// Extracted into a subcomponent to handle hook initialization
// only when consent is given.
function ActiveTracker({ userId }: { userId: string | null }) {
    const { sessionId } = useHeatmapSession(userId);
    useHeatmapTracker(userId, sessionId);
    
    // This is purely a side-effect component
    return null;
}

export default function TrackingProvider() {
    const { consentGiven } = useCookieConsent();
    const { data: session } = useNextAuthSession();
    
    // Only mount tracking hooks if consent has been explicitly given
    if (!consentGiven) return null;
    
    // Extract userId and role from existing next-auth session object
    const user = session?.user as any;
    const userId = user?.id || null;
    const userRole = user?.role || null;

    // Do not generate tracking analytics for the ADMIN role
    if (userRole === 'admin') return null;

    return <ActiveTracker userId={userId} />;
}
