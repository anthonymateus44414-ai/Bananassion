

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  side?: 'top' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, side = 'top' }) => {
  const getPositionClasses = () => {
    switch (side) {
      case 'left':
        return 'absolute right-full top-1/2 transform -translate-y-1/2 mr-3';
      case 'right':
        return 'absolute left-full top-1/2 transform -translate-y-1/2 ml-3';
      case 'top':
      default:
        return 'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch(side) {
        case 'left':
            return 'absolute top-1/2 -right-2 transform -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-text-primary';
        case 'right':
            return 'absolute top-1/2 -left-2 transform -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-text-primary';
        case 'top':
        default:
            return 'absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-text-primary';
    }
  }
  
  const textAlignClass = side === 'top' ? 'text-center' : 'text-left';

  return (
    <div className="relative flex items-center group">
      {children}
      <div className={`${getPositionClasses()} w-64
                      invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-300
                      bg-text-primary text-white text-sm font-semibold rounded-md px-3 py-1.5 shadow-lg
                      pointer-events-none z-[9999] ${textAlignClass}`}>
        {text}
        <div className={getArrowClasses()}></div>
      </div>
    </div>
  );
};

export default Tooltip;