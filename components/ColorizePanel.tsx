/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { SparklesIcon } from './icons';

interface ColorizePanelProps {
  onApplyColorize: (prompt: string) => void;
  isLoading: boolean;
}

const ColorizePanel: React.FC<ColorizePanelProps> = ({ onApplyColorize, isLoading }) => {
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Natural', prompt: 'Colorize this photo with natural, realistic colors appropriate for the scene.' },
    { name: 'Vintage', prompt: 'Colorize this photo with the muted, warm tones of a vintage photograph from the 1960s.' },
    { name: 'Vibrant', prompt: 'Colorize this photo with vibrant, highly saturated colors for a modern, punchy look.' },
  ];

  const handleApply = (prompt: string) => {
    if (prompt.trim()) {
        onApplyColorize(prompt);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleApply(customPrompt);
  }

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Colorize Photo</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Add realistic color to black and white images.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {presets.map(preset => (
          <Tooltip key={preset.name} text={preset.prompt}>
            <button
              onClick={() => handleApply(preset.prompt)}
              disabled={isLoading}
              className="w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preset.name}
            </button>
          </Tooltip>
        ))}
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 pt-2">
        <Tooltip text="Or, describe specific colors, e.g., 'a man with a blue jacket and brown hair'">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Or describe specific colors..."
            className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
            disabled={isLoading}
          />
        </Tooltip>
        
        <Tooltip text="Apply the colorization prompt to the image">
          <button
              type="submit"
              className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              disabled={isLoading || !customPrompt.trim()}
          >
              <SparklesIcon className="w-6 h-6" />
              Colorize with Prompt
          </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default ColorizePanel;
