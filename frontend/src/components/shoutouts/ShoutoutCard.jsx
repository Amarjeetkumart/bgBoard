import { useState } from 'react';
import { commentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ShoutoutCard({ shoutout, onReaction, onComment, onRefresh }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const { user } = useAuth();

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    try {
      const response = await commentAPI.getAll(shoutout.id);
      setComments(response.data);
      setShowComments(true);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    try {
      await onComment(shoutout.id, commentText);
      setCommentText('');
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReactionClick = (type) => {
    const isAdding = !shoutout.user_reactions.includes(type);
    onReaction(shoutout.id, type, isAdding);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start space-x-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
          {shoutout.sender.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{shoutout.sender.name}</p>
              <p className="text-sm text-gray-500">{formatDate(shoutout.created_at)}</p>
            </div>
          </div>
          <p className="text-gray-800 mt-2">{shoutout.message}</p>
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Tagged: {shoutout.recipients.map(r => r.name).join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6 border-t border-gray-200 pt-4">
        <button
          onClick={() => handleReactionClick('like')}
          className={`flex items-center space-x-1 ${
            shoutout.user_reactions.includes('like') ? 'text-blue-600' : 'text-gray-500'
          } hover:text-blue-600`}
        >
          <span>👍</span>
          <span>{shoutout.reaction_counts.like || 0}</span>
        </button>
        <button
          onClick={() => handleReactionClick('clap')}
          className={`flex items-center space-x-1 ${
            shoutout.user_reactions.includes('clap') ? 'text-blue-600' : 'text-gray-500'
          } hover:text-blue-600`}
        >
          <span>👏</span>
          <span>{shoutout.reaction_counts.clap || 0}</span>
        </button>
        <button
          onClick={() => handleReactionClick('star')}
          className={`flex items-center space-x-1 ${
            shoutout.user_reactions.includes('star') ? 'text-blue-600' : 'text-gray-500'
          } hover:text-blue-600`}
        >
          <span>⭐</span>
          <span>{shoutout.reaction_counts.star || 0}</span>
        </button>
        <button
          onClick={loadComments}
          className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
        >
          <span>💬</span>
          <span>{shoutout.comment_count}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm">
                  {comment.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-sm">{comment.user.name}</p>
                  <p className="text-gray-800">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="flex space-x-2">
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
