import { useState, useEffect, useRef } from 'react';

export function useSession(userId: string | null) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!userId) return;

        const storedSessionId = sessionStorage.getItem('sessionId');
        
        if (storedSessionId) {
            setSessionId(storedSessionId);
        } else if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.sessionId) {
                    sessionStorage.setItem('sessionId', data.sessionId);
                    setSessionId(data.sessionId);
                }
            })
            .catch(err => {
                console.error('Failed to start session:', err);
            });
        }
    }, [userId]);

    useEffect(() => {
        if (!sessionId) return;

        const handleBeforeUnload = () => {
            try {
                // sendBeacon requires a Blob with type application/json
                const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' });
                navigator.sendBeacon('/api/session/end', blob);
            } catch (err) {
                console.error('Failed to end session via sendBeacon:', err);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [sessionId]);

    return { sessionId };
}
