'use client';

import React, { useState, useEffect } from 'react';
import styles from './HeatmapAnalytics.module.css';

// Using a basic markdown renderer for the AI report (since we requested markdown from Gemini)
// For simplicity in this component, we safely replace basic markdown formatting.
const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Convert basic markdown to HTML safely for this internal admin use case
    let html = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/\n/gim, '<br/>');

    if (!html.startsWith('<h') && !html.startsWith('<p>')) {
        html = '<p>' + html + '</p>';
    }

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

function SessionsList() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Modal state
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    const fetchSessions = () => {
        setLoading(true);
        fetch(`/api/sessions?page=${page}&limit=10`)
            .then(res => res.json())
            .then(data => {
                if (data.sessions) {
                    setSessions(data.sessions);
                    setTotalPages(data.totalPages || 1);
                    setTotal(data.total || 0);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchSessions();
    }, [page]);

    const handleGenerateReport = async (sessionId: string) => {
        setGeneratingId(sessionId);
        try {
            const res = await fetch('/api/sessions/ai-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const data = await res.json();
            
            if (data.error) {
                alert(data.error);
            } else {
                // Update local state to reflect the new report
                setSessions(prev => prev.map(s => 
                    s.id === sessionId ? { ...s, aiReport: data.report } : s
                ));
                setSelectedReport(data.report);
                setSelectedSessionId(sessionId);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to generate report.");
        } finally {
            setGeneratingId(null);
        }
    };

    const handleViewReport = (session: any) => {
        setSelectedReport(session.aiReport);
        setSelectedSessionId(session.id);
    };

    const closeModal = () => {
        setSelectedReport(null);
        setSelectedSessionId(null);
    };

    return (
        <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
                <div>
                    <h3>User Sessions</h3>
                    <p>Total {total} sessions recorded</p>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className={styles.table} style={{ minWidth: 800 }}>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Session Start</th>
                            <th>Duration</th>
                            <th>Categories</th>
                            <th>Events</th>
                            <th>AI Report</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading sessions...</td></tr>
                        ) : sessions.length > 0 ? (
                            sessions.map(session => (
                                <tr key={session.id}>
                                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={session.userName}>
                                        {session.userName}
                                    </td>
                                    <td>
                                        {new Date(session.startedAt).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </td>
                                    <td>
                                        {session.totalDuration ? `${session.totalDuration}s` : <span style={{ color: '#16a34a', fontWeight: 600 }}>Active</span>}
                                    </td>
                                    <td>
                                        {session.categories && session.categories.length > 0 ? (
                                            <select style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#f8fafc', maxWidth: '120px' }}>
                                                {session.categories.map((c: string, i: number) => (
                                                    <option key={i} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>None</span>
                                        )}
                                    </td>
                                    <td>
                                        <strong style={{ color: '#0f172a' }}>{session.eventCount || 0}</strong>
                                    </td>
                                    <td>
                                        {session.aiReport && !session.aiReport.startsWith('Failed to') && !session.aiReport.includes('encountered an error') ? (
                                            <button className={styles.btnView} onClick={() => handleViewReport(session)}>
                                                View Report
                                            </button>
                                        ) : (
                                            <button 
                                                className={session.aiReport ? styles.btnRetry : styles.btnGenerate} 
                                                onClick={() => handleGenerateReport(session.id)}
                                                disabled={generatingId === session.id}
                                            >
                                                {generatingId === session.id 
                                                    ? 'Analyzing logs...' 
                                                    : (session.aiReport ? 'Retry AI Report' : 'Generate AI Report')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                                    <svg style={{ width: 48, height: 48, margin: '0 auto 1rem', color: '#cbd5e1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                    <p style={{ fontWeight: 500 }}>No sessions recorded yet.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className={styles.pagination}>
                <span>Page <strong style={{ color: '#0f172a' }}>{page}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong></span>
                <div>
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        Previous
                    </button>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                    >
                        Next
                    </button>
                </div>
            </div>

            {selectedReport && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2><span className={styles.aiBadge}>AI</span> Session Behavioral Report</h2>
                            <button onClick={closeModal} title="Close">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {renderMarkdown(selectedReport)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HeatmapAnalytics() {
    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ marginBottom: '1.5rem' }}>
                <div className={styles.title}>
                    <h1>User Session Analytics</h1>
                    <p>Analyze individual user interactions and generate AI-powered behavioral reports.</p>
                </div>
            </div>
            
            <div>
                <div className={styles.sectionTitle}>
                    <h2>Session Replays</h2>
                    <span className={styles.liveBadge}>Live Tracking</span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Review individual user sessions, event counts, duration, and generate deep-dive AI behavior reports based on interaction logs.</p>
                
                <SessionsList />
            </div>
        </div>
    );
}
