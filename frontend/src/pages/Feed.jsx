import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { shoutoutAPI, commentAPI, reactionAPI } from '../services/api';
import CreateShoutout from '../components/shoutouts/CreateShoutout';
import ShoutoutCard from '../components/shoutouts/ShoutoutCard';
import ErrorBoundary from '../components/common/ErrorBoundary';

export default function Feed() {
  const [shoutouts, setShoutouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchShoutouts();
  }, []);

  const fetchShoutouts = async () => {
    try {
      const response = await shoutoutAPI.getAll();
      setShoutouts(response.data);
    } catch (error) {
      console.error('Error fetching shoutouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShoutout = async (data) => {
    try {
      await shoutoutAPI.create(data);
      setShowCreateModal(false);
      fetchShoutouts();
    } catch (error) {
      console.error('Error creating shoutout:', error);
      throw error;
    }
  };

  const handleReaction = async (shoutoutId, reactionType, isAdding) => {
    try {
      if (isAdding) {
        await reactionAPI.add(shoutoutId, reactionType);
      } else {
        await reactionAPI.remove(shoutoutId, reactionType);
      }
      fetchShoutouts();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  // Align signature with ShoutoutCard: second arg is a payload { content, mentions }
  const handleComment = async (shoutoutId, payload) => {
    try {
      await commentAPI.create(shoutoutId, payload);
      fetchShoutouts();
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.department} Feed
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Shout-Out
          </button>
        </div>

        {shoutouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No shout-outs yet. Be the first to post!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorBoundary>
              {shoutouts.map((shoutout) => (
                <ShoutoutCard
                  key={shoutout.id}
                  shoutout={shoutout}
                  onReaction={handleReaction}
                  onComment={handleComment}
                  onRefresh={fetchShoutouts}
                />
              ))}
            </ErrorBoundary>
          </div>
        )}

        {showCreateModal && (
          <CreateShoutout
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateShoutout}
          />
        )}
      </div>
    </div>
  );
}
