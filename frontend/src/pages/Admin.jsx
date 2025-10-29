import DepartmentStatsChart from '../../src/components/admin/DepartmentStatsChart';

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, leaderboardRes] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.getLeaderboard(),
      ]);
      setAnalytics(analyticsRes.data);
      setLeaderboard(leaderboardRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics?.total_users || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Shout-Outs</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics?.total_shoutouts || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Contributors</h2>
            <div className="space-y-3">
              {analytics?.top_contributors?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({user.department})</span>
                  </div>
                  <span className="text-blue-600 font-semibold">
                    {user.shoutouts_sent} sent
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Most Recognized</h2>
            <div className="space-y-3">
              {analytics?.most_tagged?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({user.department})</span>
                  </div>
                  <span className="text-green-600 font-semibold">
                    {user.times_tagged} received
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Department Stats</h2>
          <DepartmentStatsChart data={analytics?.department_stats} />
        </div>
      </div>
    </div>
  );
}
