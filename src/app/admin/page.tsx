'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    Users,
    Newspaper,
    MessageSquare,
    BarChart3,
    Globe,
    Settings,
    Plus,
    Trash2,
    Edit2,
    ExternalLink,
    Clock,
    Eye,
    Shield,
    Mail,
    UserPlus,
    Search,
    Loader2
} from 'lucide-react';
import { UserRole } from '@prisma/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from './Admin.module.css';
import HeatmapAnalytics from '@/components/admin/HeatmapAnalytics';

interface Stat {
    users: number;
    articles: number;
    comments: number;
    subscribers: number;
}

interface TrendingArticle {
  articleId: string;
  title: string;
  url: string;
  visits: number;
  avgTime: number;
}

interface CategoryDistribution {
  category: string;
  visits: number;
  avgTime: number;
}

interface Newsletter {
    id: string;
    email: string;
    createdAt: string;
}

interface Source {
    id: string;
    country: string;
    name: string;
    category: string;
    url: string;
    active: boolean;
}

interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    emailVerified: string | null;
}

interface ArticleAnalytics {
    clicksByCategory: { category: string; clicks: number }[];
    topArticles: { articleId: string; category: string; clicks: number }[];
    engagement: {
        totalRecords: number;
        totalTimeSpentSeconds: number;
        avgTimeSpentSeconds: number;
    };
}

interface SearchUser {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
}

interface UserAnalytics {
    mostEngagedCategory: {
        last7Days: string | null;
        last15Days: string | null;
        last30Days: string | null;
    };
    totalClicksByCategory: { category: string; clicks: number }[];
    topArticles: { articleId: string; title: string; timeSpentSeconds: number }[];
}

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [stats, setStats] = useState<Stat | null>(null);
    const [trendingArticles, setTrendingArticles] = useState<TrendingArticle[]>([]);
    const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [newsletter, setNewsletter] = useState<Newsletter[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'analytics' | 'engagement' | 'newsletter' | 'admins' | 'user-analytics' | 'heatmap-analytics'>('overview');
    const [daysFilter, setDaysFilter] = useState<number>(30);

    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [articleAnalytics, setArticleAnalytics] = useState<ArticleAnalytics | null>(null);
    const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '' });
    const [adminFormError, setAdminFormError] = useState('');
    const [adminFormSuccess, setAdminFormSuccess] = useState('');

    const [editingSource, setEditingSource] = useState<Partial<Source> | null>(null);

    // User Analytics state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
    const [userStats, setUserStats] = useState<UserAnalytics | null>(null);
    const [loadingUserStats, setLoadingUserStats] = useState(false);

    const fetchData = async () => {
        try {
            const [sourcesRes, adminsRes, engagementRes, dashboardRes] = await Promise.all([
                fetch('/api/admin/sources'),
                fetch('/api/admin/admins'),
                fetch('/api/admin/analytics'),
                fetch(`/api/admin/analytics/dashboard?days=${daysFilter}`),
            ]);
            const data = await sourcesRes.json();
            if (sourcesRes.ok) {
                setStats(data.stats);
                setSources(data.sources);
                setNewsletter(data.newsletter);
            }
            if (adminsRes.ok) {
                const adminsData = await adminsRes.json();
                setAdmins(adminsData.admins);
            }
            if (engagementRes.ok) {
                setArticleAnalytics(await engagementRes.json());
            }
            if (dashboardRes.ok) {
                const dashData = await dashboardRes.json();
                setTrendingArticles(dashData.trendingArticles);
                setCategoryDistribution(dashData.categoryDistribution);
            }
        } catch (err) {
            console.error('Failed to fetch admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated' || (session && session.user?.role !== UserRole.admin)) {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, session, router, daysFilter]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSearchResults(data.users);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectUser = async (user: SearchUser) => {
        setSelectedUser(user);
        setSearchQuery('');
        setSearchResults([]);
        setLoadingUserStats(true);
        try {
            const res = await fetch(`/api/admin/analytics/users/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setUserStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch user stats', err);
        } finally {
            setLoadingUserStats(false);
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminFormError('');
        setAdminFormSuccess('');
        try {
            const res = await fetch('/api/admin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adminForm),
            });
            const data = await res.json();
            if (!res.ok) {
                setAdminFormError(data.message || 'Failed to create admin');
                return;
            }
            setAdminFormSuccess(data.promoted ? 'User promoted to admin' : 'Admin created successfully');
            setAdminForm({ email: '', password: '', name: '' });
            fetchData();
        } catch {
            setAdminFormError('Failed to create admin');
        }
    };

    const handleSaveSource = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingSource),
            });
            if (res.ok) {
                setEditingSource(null);
                fetchData();
            }
        } catch (err) {
            console.error('Failed to save source:', err);
        }
    };

    const handleDeleteSource = async (id: string) => {
        if (!confirm('Are you sure you want to delete this source?')) return;
        try {
            const res = await fetch('/api/admin/sources', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (res.ok) fetchData();
        } catch (err) {
            console.error('Failed to delete source:', err);
        }
    };

    if (status === 'loading' || loading) {
        return <div className={styles.loading}>Loading Dashboard...</div>;
    }

    return (
        <div className={styles.adminWrapper}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Shield size={24} color="#3b82f6" />
                    <span>Admin Central</span>
                </div>
                <nav className={styles.nav}>
                    <button
                        className={activeTab === 'overview' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('overview')}
                    >
                        <BarChart3 size={20} /> Overview
                    </button>
                    <button
                        className={activeTab === 'sources' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('sources')}
                    >
                        <Globe size={20} /> News Sources
                    </button>
                    <button
                        className={activeTab === 'analytics' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 size={20} /> Site Analytics
                    </button>
                    <button
                        className={activeTab === 'engagement' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('engagement')}
                    >
                        <Newspaper size={20} /> Article Engagement
                    </button>
                    <button
                        className={activeTab === 'user-analytics' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('user-analytics')}
                    >
                        <Users size={20} /> User Analytics
                    </button>
                    <button
                        className={activeTab === 'heatmap-analytics' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('heatmap-analytics')}
                    >
                        <Eye size={20} /> HeatMap based Analytics
                    </button>
                    <button
                        className={activeTab === 'newsletter' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('newsletter')}
                    >
                        <Mail size={20} /> Newsletter
                    </button>
                    <button
                        className={activeTab === 'admins' ? styles.navItemActive : styles.navItem}
                        onClick={() => setActiveTab('admins')}
                    >
                        <UserPlus size={20} /> Administrators
                    </button>
                    <button className={styles.navItem} onClick={() => router.push('/')}>
                        <ExternalLink size={20} /> View Site
                    </button>
                </nav>
            </aside>

            <main className={styles.mainContent}>
                <header className={styles.topHeader}>
                    <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                    <div className={styles.userProfile}>
                        <span>{session?.user?.name}</span>
                        <div className={styles.avatarMini}>{session?.user?.name?.[0]}</div>
                    </div>
                </header>

                {activeTab === 'overview' && (
                    <div className={styles.overviewGrid}>
                        <div className={styles.statsRow}>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                    <Users size={24} />
                                </div>
                                <div className={styles.statInfo}>
                                    <p>Total Users</p>
                                    <h3>{stats?.users}</h3>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: '#fef2f2', color: '#ef4444' }}>
                                    <Newspaper size={24} />
                                </div>
                                <div className={styles.statInfo}>
                                    <p>Total Articles</p>
                                    <h3>{stats?.articles}</h3>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: '#f0fdf4', color: '#10b981' }}>
                                    <MessageSquare size={24} />
                                </div>
                                <div className={styles.statInfo}>
                                    <p>Total Comments</p>
                                    <h3>{stats?.comments}</h3>
                                </div>
                            </div>
                            <div className={styles.statCard} style={{ borderLeft: '4px solid #f59e0b' }}>
                                <div className={styles.statIcon} style={{ background: '#fffbeb', color: '#f59e0b' }}>
                                    <Mail size={24} />
                                </div>
                                <div className={styles.statInfo}>
                                    <p>Subscribers</p>
                                    <h3>{stats?.subscribers}</h3>
                                </div>
                            </div>
                        </div>

                        <div className={styles.recentActivity}>
                            <h2>Top Performing Pages</h2>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Article Title</th>
                                            <th>Unique Clicks</th>
                                            <th>Avg. Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trendingArticles.map((item) => (
                                            <tr key={item.articleId}>
                                                <td className={styles.pathCell}>
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>
                                                        {item.title}
                                                    </a>
                                                </td>
                                                <td>{item.visits}</td>
                                                <td>{Math.round(item.avgTime)}s</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sources' && (
                    <div className={styles.sourcesContainer}>
                        <div className={styles.sectionHeader}>
                            <h2>Manage RSS Feeds</h2>
                            <button className={styles.addBtn} onClick={() => setEditingSource({})}>
                                <Plus size={20} /> Add New Source
                            </button>
                        </div>

                        {editingSource && (
                            <div className={styles.modalOverlay}>
                                <div className={styles.modal}>
                                    <h3>{editingSource.id ? 'Edit Source' : 'Add New Source'}</h3>
                                    <form onSubmit={handleSaveSource} className={styles.sourceForm}>
                                        <div className={styles.formGroup}>
                                            <label>Country</label>
                                            <input
                                                type="text"
                                                required
                                                value={editingSource.country || ''}
                                                onChange={e => setEditingSource({ ...editingSource, country: e.target.value.toUpperCase() })}
                                                placeholder="e.g. INDIA"
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Provider Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={editingSource.name || ''}
                                                onChange={e => setEditingSource({ ...editingSource, name: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Category</label>
                                            <select
                                                value={editingSource.category || ''}
                                                onChange={e => setEditingSource({ ...editingSource, category: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                <option value="homepage">Homepage</option>
                                                <option value="news">National News</option>
                                                <option value="world">World News</option>
                                                <option value="business">Business</option>
                                                <option value="sports">Sports</option>
                                                <option value="technology">Technology</option>
                                            </select>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>RSS URL</label>
                                            <input
                                                type="url"
                                                required
                                                value={editingSource.url || ''}
                                                onChange={e => setEditingSource({ ...editingSource, url: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.formActions}>
                                            <button type="submit" className={styles.saveBtn}>Save Source</button>
                                            <button type="button" className={styles.cancelBtn} onClick={() => setEditingSource(null)}>Cancel</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Country</th>
                                        <th>Provider</th>
                                        <th>Category</th>
                                        <th>Manage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sources.map(source => (
                                        <tr key={source.id}>
                                            <td><span className={styles.countryBadge}>{source.country}</span></td>
                                            <td>{source.name}</td>
                                            <td>{source.category}</td>
                                            <td className={styles.actionCell}>
                                                <button onClick={() => setEditingSource(source)} title="Edit"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteSource(source.id)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                                <a href={source.url} target="_blank" rel="noopener noreferrer" title="Test URL"><ExternalLink size={16} /></a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className={styles.analyticsList}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2>Full Site Traffic</h2>
                            <select 
                                value={daysFilter} 
                                onChange={(e) => setDaysFilter(parseInt(e.target.value))}
                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '150px' }}
                            >
                                <option value={7}>Last 7 Days</option>
                                <option value={15}>Last 15 Days</option>
                                <option value={30}>Last 30 Days</option>
                            </select>
                        </div>
                        
                        <div style={{ width: '100%', height: 400, marginTop: '2rem' }}>
                            <ResponsiveContainer>
                                <BarChart
                                    data={categoryDistribution}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="category" />
                                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                                    <Tooltip />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="visits" name="Total Visits" fill="#3b82f6" />
                                    <Bar yAxisId="right" dataKey="avgTime" name="Avg Time (s)" fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'engagement' && articleAnalytics && (
                    <div className={styles.analyticsList}>
                        <h2>Article Engagement</h2>
                        <div className={styles.statsRow}>
                            <div className={styles.statCard}>
                                <div className={styles.statInfo}>
                                    <p>Engagement Records</p>
                                    <h3>{articleAnalytics.engagement.totalRecords}</h3>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statInfo}>
                                    <p>Total Reading Time</p>
                                    <h3>{Math.round(articleAnalytics.engagement.totalTimeSpentSeconds / 60)} min</h3>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statInfo}>
                                    <p>Avg. Time per Session</p>
                                    <h3>{Math.round(articleAnalytics.engagement.avgTimeSpentSeconds)}s</h3>
                                </div>
                            </div>
                        </div>
                        <h3 style={{ marginTop: '2rem' }}>Clicks by Category</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Clicks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {articleAnalytics.clicksByCategory.map((row) => (
                                        <tr key={row.category}>
                                            <td>{row.category}</td>
                                            <td>{row.clicks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <h3 style={{ marginTop: '2rem' }}>Top Articles</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Article ID</th>
                                        <th>Category</th>
                                        <th>Clicks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {articleAnalytics.topArticles.map((row) => (
                                        <tr key={`${row.articleId}-${row.category}`}>
                                            <td className={styles.pathCell}>{row.articleId}</td>
                                            <td>{row.category}</td>
                                            <td>{row.clicks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className={styles.sourcesContainer}>
                        <div className={styles.sectionHeader}>
                            <h2>Administrators</h2>
                        </div>

                        <form onSubmit={handleCreateAdmin} className={styles.sourceForm} style={{ marginBottom: '2rem', maxWidth: 480 }}>
                            <h3>Add Admin</h3>
                            {adminFormError && <p style={{ color: '#ef4444' }}>{adminFormError}</p>}
                            {adminFormSuccess && <p style={{ color: '#10b981' }}>{adminFormSuccess}</p>}
                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={adminForm.email}
                                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={adminForm.password}
                                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Name (optional)</label>
                                <input
                                    type="text"
                                    value={adminForm.name}
                                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                                />
                            </div>
                            <button type="submit" className={styles.saveBtn}>Create Admin</button>
                        </form>

                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Name</th>
                                        <th>Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((admin) => (
                                        <tr key={admin.id}>
                                            <td className={styles.pathCell}>{admin.email}</td>
                                            <td>{admin.name || '—'}</td>
                                            <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'newsletter' && (
                    <div className={styles.analyticsList}>
                        <h2>Newsletter Subscribers</h2>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Email Address</th>
                                        <th>Joined Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newsletter.map(sub => (
                                        <tr key={sub.id}>
                                            <td className={styles.pathCell}>{sub.email}</td>
                                            <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {newsletter.length === 0 && (
                                        <tr>
                                            <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                                No subscribers yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'user-analytics' && (
                    <div className={styles.analyticsList}>
                        <div className={styles.sectionHeader}>
                            <h2>Individual User Analytics</h2>
                        </div>
                        
                        <div className={styles.searchContainer}>
                            <Search className={styles.searchIcon} size={20} />
                            <input 
                                type="text" 
                                className={styles.searchInput} 
                                placeholder="Search user by email address..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && <Loader2 className={styles.searchSpinner} style={{ animation: 'spin 1s linear infinite' }} size={20} color="#3b82f6" />}
                            
                            {searchResults.length > 0 && (
                                <div className={styles.dropdown}>
                                    {searchResults.map(user => (
                                        <div key={user.id} className={styles.dropdownItem} onClick={() => handleSelectUser(user)}>
                                            <div className={styles.userAvatar}>
                                                {user.image ? <img src={user.image} alt="avatar" style={{width: '100%', borderRadius: '50%'}} /> : (user.name?.[0] || user.email[0].toUpperCase())}
                                            </div>
                                            <div className={styles.userInfo}>
                                                <span className={styles.userName}>{user.name || 'Anonymous User'}</span>
                                                <span className={styles.userEmail}>{user.email}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {loadingUserStats ? (
                            <div className={styles.noDataMessage}>Loading user statistics...</div>
                        ) : selectedUser && userStats ? (
                            <div>
                                <div className={styles.selectedUserHeader}>
                                    <div className={styles.userAvatar} style={{width: 64, height: 64, fontSize: '2rem'}}>
                                        {selectedUser.image ? <img src={selectedUser.image} alt="avatar" style={{width: '100%', borderRadius: '50%'}} /> : (selectedUser.name?.[0] || selectedUser.email[0].toUpperCase())}
                                    </div>
                                    <div className={styles.selectedUserDetails}>
                                        <h2>{selectedUser.name || 'Anonymous User'}</h2>
                                        <p>{selectedUser.email}</p>
                                    </div>
                                </div>

                                <h3>Most Engaged Category</h3>
                                <div className={styles.statsRow} style={{ marginTop: '1rem' }}>
                                    <div className={styles.statCard}>
                                        <div className={styles.statInfo}>
                                            <p>Last 7 Days</p>
                                            <h3>{userStats.mostEngagedCategory.last7Days || 'None'}</h3>
                                        </div>
                                    </div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statInfo}>
                                            <p>Last 15 Days</p>
                                            <h3>{userStats.mostEngagedCategory.last15Days || 'None'}</h3>
                                        </div>
                                    </div>
                                    <div className={styles.statCard}>
                                        <div className={styles.statInfo}>
                                            <p>Last 30 Days</p>
                                            <h3>{userStats.mostEngagedCategory.last30Days || 'None'}</h3>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '3rem' }}>
                                    <div>
                                        <h3>Total Clicks by Category</h3>
                                        <div className={styles.tableWrapper} style={{ marginTop: '1rem' }}>
                                            <table className={styles.table}>
                                                <thead>
                                                    <tr>
                                                        <th>Category</th>
                                                        <th>Total Clicks</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {userStats.totalClicksByCategory.map(row => (
                                                        <tr key={row.category}>
                                                            <td><span className={styles.countryBadge}>{row.category}</span></td>
                                                            <td>{row.clicks}</td>
                                                        </tr>
                                                    ))}
                                                    {userStats.totalClicksByCategory.length === 0 && (
                                                        <tr>
                                                            <td colSpan={2} style={{textAlign: 'center'}}>No clicks recorded.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div>
                                        <h3>Top Read Articles</h3>
                                        <div className={styles.tableWrapper} style={{ marginTop: '1rem' }}>
                                            <table className={styles.table}>
                                                <thead>
                                                    <tr>
                                                        <th>Article Title</th>
                                                        <th>Time Spent</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {userStats.topArticles.map(row => (
                                                        <tr key={row.articleId}>
                                                            <td className={styles.pathCell} style={{maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.title}>
                                                                {row.title}
                                                            </td>
                                                            <td>{row.timeSpentSeconds}s</td>
                                                        </tr>
                                                    ))}
                                                    {userStats.topArticles.length === 0 && (
                                                        <tr>
                                                            <td colSpan={2} style={{textAlign: 'center'}}>No reading time recorded.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noDataMessage}>
                                Search for a user by email address to view their detailed analytics.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'heatmap-analytics' && (
                    <div className={styles.analyticsList}>
                        <HeatmapAnalytics />
                    </div>
                )}
            </main>
        </div>
    );
}
