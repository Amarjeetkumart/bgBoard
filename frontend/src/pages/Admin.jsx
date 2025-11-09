import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, shoutoutAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DepartmentStatsChart from '../../src/components/admin/DepartmentStatsChart';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shoutoutPreview, setShoutoutPreview] = useState({ open: false, data: null, loading: false, error: '' });

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    try {
      const [analyticsRes, leaderboardRes, reportsRes] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.getLeaderboard(),
        adminAPI.getReports(),
      ]);
      setAnalytics(analyticsRes.data);
      setLeaderboard(leaderboardRes.data);
      setReports(reportsRes.data || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId, action) => {
    try {
      await adminAPI.resolveReport(reportId, action);
      // refresh reports only
      const res = await adminAPI.getReports();
      setReports(res.data || []);
    } catch (e) {
      console.error('Failed to resolve report', e);
    }
  };

  const handleDeleteShoutout = async (id) => {
    try {
      await adminAPI.deleteShoutout(id);
      // refresh both analytics and reports as counts change
      fetchData();
    } catch (e) {
      console.error('Failed to delete shoutout', e);
    }
  };

  const openShoutout = async (id) => {
    setShoutoutPreview({ open: true, data: null, loading: true, error: '' });
    try {
      const res = await shoutoutAPI.getOne(id);
      setShoutoutPreview({ open: true, data: res.data, loading: false, error: '' });
    } catch (e) {
      setShoutoutPreview({ open: true, data: null, loading: false, error: e?.response?.data?.detail || 'Failed to load shout-out' });
    }
  };

  const closeShoutout = () => setShoutoutPreview({ open: false, data: null, loading: false, error: '' });

  if (authLoading || loading) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.total_users || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Shout-Outs</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.total_shoutouts || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Top Contributors</h2>
            <div className="space-y-3">
              {analytics?.top_contributors?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({user.department})</span>
                  </div>
                  <span className="text-blue-600 font-semibold">
                    {user.shoutouts_sent} sent
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Most Recognized</h2>
            <div className="space-y-3">
              {analytics?.most_tagged?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({user.department})</span>
                  </div>
                  <span className="text-green-600 font-semibold">
                    {user.times_tagged} received
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Department Stats</h2>
          <DepartmentStatsChart data={analytics?.department_stats} />
        </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Reported Shout-Outs</h2>
            {reports.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No reports.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shoutout</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">#{r.id}</td>
                        <td className="px-4 py-2 text-sm text-blue-600">
                          <button onClick={() => handleDeleteShoutout(r.shoutout_id)} className="text-red-600 hover:underline mr-2">Delete</button>
                          <button onClick={() => openShoutout(r.shoutout_id)} className="text-blue-600 hover:underline">View</button>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-right space-x-2">
                          {r.status === 'pending' && (
                            <>
                              <button onClick={() => handleResolve(r.id, 'approved')} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                              <button onClick={() => handleResolve(r.id, 'rejected')} className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>
    </div>
    {shoutoutPreview.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shout-Out Preview</h3>
            <button onClick={closeShoutout} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-4 space-y-4">
            {shoutoutPreview.loading && <p className="text-sm text-gray-500">Loading…</p>}
            {shoutoutPreview.error && <p className="text-sm text-red-600">{shoutoutPreview.error}</p>}
            {shoutoutPreview.data && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">ID: {shoutoutPreview.data.id}</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{shoutoutPreview.data.sender?.name}</p>
                  <p className="text-xs text-gray-500">{new Date(shoutoutPreview.data.created_at).toLocaleString()}</p>
                </div>
                <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{shoutoutPreview.data.message}</p>
                {Array.isArray(shoutoutPreview.data.attachments) && shoutoutPreview.data.attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Attachments</p>
                    <div className="grid grid-cols-2 gap-3">
                      {shoutoutPreview.data.attachments.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block group">
                          {a.type?.startsWith('image/') ? (
                            <img src={a.url} alt={a.name} className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700" />
                          ) : (
                            <div className="h-32 flex items-center justify-center text-xs bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                              📄 {a.name}
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-1">Tagged Recipients</p>
                  <div className="flex flex-wrap gap-2">
                    {(shoutoutPreview.data.recipients || []).map(r => (
                      <span key={r.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">{r.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>Comments: {shoutoutPreview.data.comment_count}</span>
                  <span>Reactions: {Object.values(shoutoutPreview.data.reaction_counts || {}).reduce((a,b)=>a+b,0)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button onClick={() => { closeShoutout(); openShoutout(shoutoutPreview.data.id); }} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">Refresh</button>
                  <button onClick={() => handleDeleteShoutout(shoutoutPreview.data.id)} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Delete</button>
                  <button onClick={closeShoutout} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm ml-2">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
