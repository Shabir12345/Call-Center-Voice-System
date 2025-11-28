/**
 * Feedback Form Component
 * 
 * Collects customer feedback after calls with ratings and comments.
 */

import React, { useState } from 'react';
import { Star, MessageSquare, X, Send, CheckCircle } from 'lucide-react';
import { FeedbackCollector, FeedbackRating, NPSRating } from '../utils/feedbackCollector';

interface FeedbackFormProps {
  sessionId: string;
  collector: FeedbackCollector;
  onSubmitted?: (feedbackId: string) => void;
  onClose?: () => void;
  showNPS?: boolean;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({
  sessionId,
  collector,
  onSubmitted,
  onClose,
  showNPS = false
}) => {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [npsRating, setNpsRating] = useState<NPSRating | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!rating && !npsRating) {
      alert('Please provide a rating');
      return;
    }

    const feedback = collector.submitFeedback({
      sessionId,
      rating: rating || undefined,
      npsRating: npsRating || undefined,
      comment: comment.trim() || undefined
    });

    setSubmitted(true);
    if (onSubmitted) {
      onSubmitted(feedback.id);
    }

    // Auto-close after 2 seconds
    setTimeout(() => {
      if (onClose) onClose();
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="text-center">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Thank You!</h3>
          <p className="text-sm text-slate-600">Your feedback has been submitted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-6 w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">How was your experience?</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Star Rating */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          Rate your experience
        </label>
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4, 5] as FeedbackRating[]).map((value) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              className={`p-2 transition-colors ${
                rating && rating >= value
                  ? 'text-amber-500'
                  : 'text-slate-300 hover:text-amber-400'
              }`}
            >
              <Star size={32} className={rating && rating >= value ? 'fill-current' : ''} />
            </button>
          ))}
        </div>
      </div>

      {/* NPS Rating */}
      {showNPS && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            How likely are you to recommend us? (0-10)
          </label>
          <div className="flex items-center gap-1 flex-wrap">
            {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as NPSRating[]).map((value) => (
              <button
                key={value}
                onClick={() => setNpsRating(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  npsRating === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      )}

      {/* Comment */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Additional comments (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your experience..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={4}
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!rating && !npsRating}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={18} />
        Submit Feedback
      </button>
    </div>
  );
};

export default FeedbackForm;

