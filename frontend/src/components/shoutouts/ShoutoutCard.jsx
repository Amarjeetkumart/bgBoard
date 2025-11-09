import { useState } from 'react';
import { commentAPI, reactionAPI, adminAPI } from '../../services/api';
import CommentInput from './CommentInput';

export default function ShoutoutCard({ shoutout, onReaction, onComment, onRefresh }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [reactorPanel, setReactorPanel] = useState({ open: false, type: null, loading: false, users: [] });
  const [reportModal, setReportModal] = useState({ open: false, reason: '', submitting: false, submitted: false, error: '' });
  // no local loading state required for now

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    try {
      const response = await commentAPI.getAll(shoutout.id);
      setComments(response.data);
      setShowComments(true);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const mentionRegex = /@\[(.*?)\]\((.*?)\)/g;
    let match;
    const mentions = [];
    while ((match = mentionRegex.exec(commentText)) !== null) {
      mentions.push(match[2]);
    }

    try {
      await onComment(shoutout.id, { content: commentText, mentions });
      setCommentText('');
      // We need to reload the comments after adding a new one.
      // We can do this by calling onRefresh, which will refetch the shoutouts.
      onRefresh();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReactionClick = (type) => {
    const isAdding = !(shoutout.user_reactions || []).includes(type);
    onReaction(shoutout.id, type, isAdding);
  };

  const openReactors = async (type) => {
    setReactorPanel({ open: true, type, loading: true, users: [] });
    try {
      const res = await reactionAPI.listUsers(shoutout.id, type);
      const users = res.data?.users?.[type] || [];
      setReactorPanel({ open: true, type, loading: false, users });
    } catch (e) {
      console.error('Failed to load reactors', e);
      setReactorPanel({ open: true, type, loading: false, users: [] });
    }
  };

  const closeReactors = () => setReactorPanel({ open: false, type: null, loading: false, users: [] });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow p-6 card">
      <div className="flex items-start space-x-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
          {(shoutout.sender?.name?.charAt(0)?.toUpperCase()) || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{shoutout.sender?.name || 'Unknown'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(shoutout.created_at)}</p>
            </div>
          </div>
          <p className="text-gray-800 dark:text-gray-100 mt-2">{shoutout.message}</p>
          {Array.isArray(shoutout.attachments) && shoutout.attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {shoutout.attachments.map((att, idx) => (
                <AttachmentPreview key={idx} attachment={att} />
              ))}
            </div>
          )}
          <div className="mt-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Tagged: {(shoutout.recipients || []).map(r => r.name).join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6 border-t border-gray-200 dark:border-gray-800 pt-4">
        <button
          onClick={() => handleReactionClick('like')}
          className={`flex items-center space-x-1 ${
            (shoutout.user_reactions || []).includes('like') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
          } hover:text-blue-600`}
        >
          <span>👍</span>
          <span>{(shoutout.reaction_counts || {}).like || 0}</span>
        </button>
        <button onClick={() => openReactors('like')} className="text-xs text-gray-500 hover:text-blue-600">Who?</button>
        <button
          onClick={() => handleReactionClick('clap')}
          className={`flex items-center space-x-1 ${
            (shoutout.user_reactions || []).includes('clap') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
          } hover:text-blue-600`}
        >
          <span>👏</span>
          <span>{(shoutout.reaction_counts || {}).clap || 0}</span>
        </button>
        <button onClick={() => openReactors('clap')} className="text-xs text-gray-500 hover:text-blue-600">Who?</button>
        <button
          onClick={() => handleReactionClick('star')}
          className={`flex items-center space-x-1 ${
            (shoutout.user_reactions || []).includes('star') ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
          } hover:text-blue-600`}
        >
          <span>⭐</span>
          <span>{(shoutout.reaction_counts || {}).star || 0}</span>
        </button>
        <button onClick={() => openReactors('star')} className="text-xs text-gray-500 hover:text-blue-600">Who?</button>
        <button
          onClick={loadComments}
          className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-blue-600"
        >
          <span>💬</span>
          <span>{shoutout.comment_count ?? 0}</span>
        </button>
        <button
          onClick={() => setReportModal({ open: true, reason: '', submitting: false, submitted: false, error: '' })}
          className="ml-auto text-sm text-red-600 hover:text-red-700"
          title="Report this shout-out"
        >
          Report
        </button>
      </div>

      {reactorPanel.open && (
        <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-md p-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              {reactorPanel.type === 'like' ? '👍 Likes' : reactorPanel.type === 'clap' ? '👏 Claps' : '⭐ Stars'}
            </div>
            <button onClick={closeReactors} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
          </div>
          {reactorPanel.loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : reactorPanel.users.length === 0 ? (
            <div className="text-sm text-gray-500">No one yet</div>
          ) : (
            <ul className="space-y-1">
              {reactorPanel.users.map(u => (
                <li key={u.id} className="text-sm text-gray-800 dark:text-gray-100 flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span>{u.name}</span>
                  <span className="text-gray-500">({u.email})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showComments && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-4">
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 text-sm">
                  {(comment.user?.name?.charAt(0)?.toUpperCase()) || '?'}
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{comment.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</p>
                  </div>
                  <p className="text-gray-800 dark:text-gray-100">{renderMentions(comment.content)}</p>
                </div>
              </div>
            ))}
          </div>
          <CommentInput
            value={commentText}
            onChange={(v) => setCommentText(v || '')}
            onAddComment={handleAddComment}
          />
        </div>
      )}

      {reportModal.open && (
        <ReportModal
          reason={reportModal.reason}
          submitting={reportModal.submitting}
          submitted={reportModal.submitted}
          error={reportModal.error}
          onChange={(v) => setReportModal((s) => ({ ...s, reason: v }))}
          onClose={() => setReportModal({ open: false, reason: '', submitting: false, submitted: false, error: '' })}
          onSubmit={async () => {
            if (!reportModal.reason.trim()) {
              setReportModal((s) => ({ ...s, error: 'Please provide a reason.' }));
              return;
            }
            try {
              setReportModal((s) => ({ ...s, submitting: true, error: '' }));
              await adminAPI.reportShoutout(shoutout.id, reportModal.reason.trim());
              setReportModal((s) => ({ ...s, submitting: false, submitted: true }));
            } catch (e) {
              const msg = e?.response?.data?.detail || 'Failed to submit report';
              setReportModal((s) => ({ ...s, submitting: false, error: msg }));
            }
          }}
        />
      )}
    </div>
  );
}

// Helper to render @mentions nicely from markup @[display](id)
function renderMentions(text) {
  if (!text) return null;
  const nodes = [];
  const regex = /@\[(.+?)\]\((\d+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const display = match[1];
    nodes.push(
      <span key={`m-${match.index}`} className="text-blue-600 font-medium">@{display}</span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function AttachmentPreview({ attachment }) {
  const url = attachment?.url || attachment;
  const name = attachment?.name || (typeof attachment === 'string' ? attachment.split('/').pop() : 'file');
  const isImage = typeof attachment === 'object' ? (attachment.type || '').startsWith('image/') : /\.(png|jpe?g|gif|webp)$/i.test(url || '');
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      {isImage ? (
        <img src={url} alt={name} className="w-full h-40 object-cover rounded border border-gray-200 dark:border-gray-700" />
      ) : (
        <div className="h-40 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
          📄 {name}
        </div>
      )}
    </a>
  );
}

function ReportModal({ reason, submitting, submitted, error, onChange, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Report Shout-Out</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        {submitted ? (
          <div className="space-y-4">
            <p className="text-green-700 bg-green-50 border border-green-200 rounded p-3">Report submitted. Thank you.</p>
            <div className="text-right">
              <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
            </div>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => onChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Describe what's inappropriate or needs review"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700">Cancel</button>
              <button onClick={onSubmit} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
