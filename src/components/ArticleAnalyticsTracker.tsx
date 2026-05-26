'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ArticleAnalyticsTrackerProps {
  articleId: string;
  category: string;
  title?: string;
}

/**
 * Tracks article clicks and reading engagement.
 *
 * Uses a periodic heartbeat (every 30s) plus visibilitychange/beforeunload
 * events to reliably record time spent reading. The old cleanup-on-unmount
 * approach was unreliable because:
 *   1. Next.js App Router page transitions don't always trigger React unmount
 *   2. fetch() during page teardown is often cancelled by the browser
 *   3. React 18 Strict Mode double-mounts cause premature cleanup calls
 */
export default function ArticleAnalyticsTracker({
  articleId,
  category,
  title,
}: ArticleAnalyticsTrackerProps) {
  const startTimeRef = useRef<number>(Date.now());
  const lastSentRef = useRef<number>(Date.now());
  const clickRecordedRef = useRef(false);
  const isSendingRef = useRef(false);

  // Send engagement data for the time elapsed since the last send
  const sendEngagement = useCallback((force = false) => {
    if (!articleId || isSendingRef.current) return;

    const now = Date.now();
    const durationSeconds = Math.round((now - lastSentRef.current) / 1000);

    // Only send if at least 5 seconds have elapsed (avoid noise)
    if (durationSeconds < 5 && !force) return;

    // Update the last-sent timestamp BEFORE the async call to prevent
    // double-sends from concurrent triggers (visibilitychange + beforeunload)
    lastSentRef.current = now;
    isSendingRef.current = true;

    // Use navigator.sendBeacon for reliability during page unload
    const payload = JSON.stringify({ articleId, category, durationSeconds });
    const sent = navigator.sendBeacon(
      '/api/analytics/engagement',
      new Blob([payload], { type: 'application/json' })
    );

    // Fallback to fetch with keepalive if sendBeacon fails
    if (!sent) {
      fetch('/api/analytics/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }

    isSendingRef.current = false;
  }, [articleId, category]);

  // Record click on mount
  useEffect(() => {
    if (!articleId || clickRecordedRef.current) return;
    clickRecordedRef.current = true;

    const now = Date.now();
    startTimeRef.current = now;
    lastSentRef.current = now;

    fetch('/api/analytics/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, category, title: title || '' }),
      keepalive: true,
    }).catch(() => {});
  }, [articleId, category, title]);

  // Heartbeat: send engagement every 30 seconds while on the page
  useEffect(() => {
    if (!articleId) return;

    const interval = setInterval(() => {
      // Only send if the page is visible (user is actually reading)
      if (document.visibilityState === 'visible') {
        sendEngagement();
      }
    }, 30_000); // 30 seconds

    return () => clearInterval(interval);
  }, [articleId, sendEngagement]);

  // Send on visibility change (tab switch, minimize) and before unload (close/navigate)
  useEffect(() => {
    if (!articleId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendEngagement(true);
      }
    };

    const handleBeforeUnload = () => {
      sendEngagement(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // On cleanup (navigation within the SPA), send remaining engagement
      sendEngagement(true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [articleId, sendEngagement]);

  return null;
}
