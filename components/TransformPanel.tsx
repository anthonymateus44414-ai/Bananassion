/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';

interface TransformPanelProps {
  onApplyTransform: (prompt: string) => void;
  isLoading: boolean;
}

const TransformPanel: React.FC<TransformPanelProps> = ({ onApplyTransform, isLoading }) => {
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Make Subject 20% Smaller', prompt: 'make the main subject 20% smaller and realistically fill in the background.' },
    { name: 'Make Subject 20% Larger', prompt: 'make the main subject 20% larger, cropping into the image slightly if necessary.' },
    { name: 'Move Subject Left', prompt: 'move the main subject to the left in the frame and realistically fill in the background.' },
    { name: 'Move Subject Right', prompt: 'move the main subject to the right in the frame and realistically fill in the background.' },
    { name: 'Move Subject Up', prompt: 'move the main subject up in the frame and realistically fill in the background.' },
    { name: 'Move Subject Down', prompt: 'move the main subject down in the frame and realistically fill in the background.' },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onApplyTransform(customPrompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Transform Image</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Use text prompts to change the composition of the image.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {presets.map(preset => (
          <Tooltip key={preset.name} text={preset.name}>
            <button
              onClick={() => onApplyTransform(preset.prompt)}
              disabled={isLoading}
              className="w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preset.name}
            </button>
          </Tooltip>
        ))}
      </div>
      
      <form onSubmit={handleApplyCustom} className="flex gap-2">
        <Tooltip text="Describe a custom transformation (e.g., 'put the subject in the bottom left corner')">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Or describe a custom transformation..."
              className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
              disabled={isLoading}
            />
        </Tooltip>
        <Tooltip text="Apply custom transformation">
            <button
              type="submit"
              className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-95 disabled:opacity-50"
              disabled={isLoading || !customPrompt.trim()}
            >
              Apply
            </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default TransformPanel;