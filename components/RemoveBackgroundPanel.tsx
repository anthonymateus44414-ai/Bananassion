/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { SparklesIcon } from './icons';
import Tooltip from './Tooltip';

interface RemoveBackgroundPanelProps {
  onApplyTransparentBackground: () => void;
  isLoading: boolean;
}

const RemoveBackgroundPanel: React.FC<RemoveBackgroundPanelProps> = ({ onApplyTransparentBackground, isLoading }) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Remove Background</h3>
      <p className="text-sm text-center text-gray-400 -mt-2 max-w-xs">
        Automatically detect the main subject and make the background transparent. The result will be a PNG file.
      </p>

      <Tooltip text="Create a PNG with a transparent background">
        <button
          onClick={onApplyTransparentBackground}
          disabled={isLoading}
          className="w-full max-w-sm mt-2 bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          <SparklesIcon className="w-6 h-6" />
          Make Background Transparent
        </button>
      </Tooltip>
    </div>
  );
};

export default RemoveBackgroundPanel;