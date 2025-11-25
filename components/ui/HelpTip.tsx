import React, { useState } from 'react';
import { Info } from 'lucide-react';

export const HelpTip: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-flex items-center ml-1.5 nodrag ${className}`}>
      <button
        className="text-gray-400 hover:text-indigo-500 transition-colors focus:outline-none"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
             e.preventDefault();
             e.stopPropagation();
             setIsVisible(!isVisible);
        }}
        type="button"
      >
        <Info size={12} />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-gray-800 text-white text-[10px] font-medium rounded-md shadow-xl z-[100] pointer-events-none leading-tight border border-gray-700">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};
