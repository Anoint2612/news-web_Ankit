import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function useHeatmapTracker(userId: string | null, sessionId: string | null) {
    const pathname = usePathname();
    const eventsRef = useRef<any[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastScrollDepthRef = useRef<number>(0);
    const lastMouseMoveRef = useRef<number>(0);

    const flush = useCallback(() => {
        if (eventsRef.current.length === 0) return;

        const eventsToSend = [...eventsRef.current];
        eventsRef.current = [];

        try {
            fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: eventsToSend }),
                keepalive: true,
            }).catch(e => console.error('Failed to flush heatmap events:', e));
        } catch (e) {
            console.error('Failed to prepare flush:', e);
        }
    }, []);

    // Set up regular 3-second flush interval
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        timerRef.current = setInterval(() => {
            flush();
        }, 3000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [flush]);

    // Reset scroll tracking and flush events on route change
    useEffect(() => {
        lastScrollDepthRef.current = 0;
        flush();
    }, [pathname, flush]);

    // Set up event listeners
    useEffect(() => {
        if (!userId || !sessionId) return;

        const checkConsent = () => {
            try {
                return localStorage.getItem('cookie_consent') === 'accepted';
            } catch {
                return false;
            }
        };

        if (!checkConsent()) return;

        const getViewport = () => ({
            width: window.innerWidth,
            height: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
        });

        const addEvent = (eventData: any) => {
            eventsRef.current.push({
                ...eventData,
                page: pathname || 'unknown',
                userId,
                sessionId,
                viewport: getViewport(),
                timestamp: new Date().toISOString(),
            });

            if (eventsRef.current.length >= 10) {
                flush();
            }
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const x = (e.clientX / window.innerWidth) * 100;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const y = ((e.clientY + scrollY) / scrollHeight) * 100;

            addEvent({
                type: 'click',
                x: Number(x.toFixed(2)),
                y: Number(y.toFixed(2)),
                tagName: target?.tagName?.toLowerCase() || '',
                id: target?.id || '',
            });
        };

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastMouseMoveRef.current < 100) return;
            lastMouseMoveRef.current = now;

            const x = (e.clientX / window.innerWidth) * 100;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const y = ((e.clientY + scrollY) / scrollHeight) * 100;

            addEvent({
                type: 'mousemove',
                x: Number(x.toFixed(2)),
                y: Number(y.toFixed(2)),
            });
        };

        const handleScroll = () => {
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const innerHeight = window.innerHeight;
            
            if (scrollHeight <= innerHeight) return;

            const depth = (scrollY / (scrollHeight - innerHeight)) * 100;
            
            if (depth - lastScrollDepthRef.current > 10) {
                lastScrollDepthRef.current = depth;
                addEvent({
                    type: 'scroll',
                    depth: Number(depth.toFixed(2)),
                });
            }
        };

        const handleBeforeUnload = () => {
            flush();
        };

        document.addEventListener('click', handleClick);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('scroll', handleScroll);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            flush(); // Flush any remaining events on cleanup
        };
    }, [userId, sessionId, pathname, flush]);
}
