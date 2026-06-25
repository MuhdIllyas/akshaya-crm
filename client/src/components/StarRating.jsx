import React, { useState } from 'react';
import { FiStar } from 'react-icons/fi';

const StarRating = ({ 
  rating = 0, 
  onRatingChange, 
  size = 'md', 
  editable = true,
  showLabel = true,
  label = 'Rating'
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };

  const starSize = sizes[size] || sizes.md;

  const handleMouseEnter = (index) => {
    if (editable) {
      setHoverRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (editable) {
      setHoverRating(0);
    }
  };

  const handleClick = (index) => {
    if (editable && onRatingChange) {
      onRatingChange(index);
    }
  };

  return (
    <div className="flex flex-col">
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {editable && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = (hoverRating || rating) >= star;
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
              className={`${editable ? 'cursor-pointer' : 'cursor-default'} focus:outline-none transition-transform ${editable && 'hover:scale-110'}`}
              disabled={!editable}
            >
              <FiStar
                className={`${starSize} ${
                  isActive
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                } transition-colors`}
              />
            </button>
          );
        })}
        {showLabel && (
          <span className="ml-2 text-sm text-gray-500">
            {rating > 0 ? `${rating}/5` : 'Not rated'}
          </span>
        )}
      </div>
    </div>
  );
};

export default StarRating;