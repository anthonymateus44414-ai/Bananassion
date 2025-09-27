/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  return (
    <div className="relative flex items-center group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs
                      invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-300
                      bg-gray-900/80 backdrop-blur-sm text-white text-xs font-semibold rounded-md px-3 py-1.5 shadow-lg
                      pointer-events-none z-50 whitespace-nowrap">
        {text}
        <svg className="absolute text-gray-900/80 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
          <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
        </svg>
      </div>
    </div>
  );
};

export default Tooltip;
