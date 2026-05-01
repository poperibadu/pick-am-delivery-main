import { useState } from 'react';
import { Button } from './ui/button';
import { Star } from '@phosphor-icons/react';
import supabase from '../lib/supabase';

export default function RatingModal({ packageId, riderName, onClose, onRated }) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rate_rider', {
        p_package_id: packageId,
        p_rating: rating,
        p_comment: comment
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setSubmitted(true);
      if (onRated) onRated(rating);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      alert(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm sm:rounded-none border-t-2 border-[#0A0A0A] sm:border-2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-4">
            <div className="flex justify-center gap-1 mb-3">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={28} weight="fill" className={s <= rating ? 'text-[#FF5B22]' : 'text-[#E4E4E7]'} />
              ))}
            </div>
            <p className="text-lg font-bold text-[#0A0A0A]">Thank you!</p>
            <p className="text-sm text-[#52525B]">Your rating has been submitted.</p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-2">Rate Your Rider</p>
            <p className="text-lg font-bold text-[#0A0A0A] mb-1">{riderName}</p>
            <p className="text-sm text-[#52525B] mb-5">How was the delivery experience?</p>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-2" data-testid="rating-stars">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  data-testid={`rating-star-${star}`}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={36}
                    weight={star <= (hoveredStar || rating) ? 'fill' : 'regular'}
                    className={star <= (hoveredStar || rating) ? 'text-[#FF5B22]' : 'text-[#E4E4E7]'}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-medium text-[#52525B] mb-4 h-5">
              {labels[hoveredStar || rating] || ''}
            </p>

            {/* Comment */}
            <textarea
              data-testid="rating-comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a comment (optional)"
              className="w-full border border-[#E4E4E7] p-3 text-sm resize-none h-20 mb-4 focus:outline-none focus:border-[#0A0A0A]"
            />

            <div className="flex gap-2">
              <Button
                data-testid="submit-rating-btn"
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1 h-12 bg-[#0A0A0A] text-white rounded-sm font-semibold hover:bg-[#0A0A0A]/90 disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : 'Submit Rating'}
              </Button>
              <Button
                data-testid="skip-rating-btn"
                onClick={onClose}
                variant="outline"
                className="h-12 px-5 rounded-sm border-[#E4E4E7]"
              >
                Skip
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

