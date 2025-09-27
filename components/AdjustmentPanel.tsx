/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Tool } from '../types';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { prompt: string } }) => void;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, isLoading, mode = 'interactive', onAddToRecipe }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Blur Background', prompt: 'Apply a realistic depth-of-field effect, making the background blurry while keeping the main subject in sharp focus.' },
    { name: 'Enhance Details', prompt: 'Slightly enhance the sharpness and details of the image without making it look unnatural.' },
    { name: 'Warmer Lighting', prompt: 'Adjust the color temperature to give the image warmer, golden-hour style lighting.' },
    { name: 'Studio Light', prompt: 'Add dramatic, professional studio lighting to the main subject.' },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
  };

  const handleApply = () => {
    if (activePrompt) {
        if (mode === 'interactive') {
            onApplyAdjustment(activePrompt);
        } else if (onAddToRecipe) {
            const selectedPreset = presets.find(p => p.prompt === selectedPresetPrompt);
            const stepName = selectedPreset?.name || `Custom: ${activePrompt.slice(0, 15)}...`;
            onAddToRecipe({
                name: `Adjust: ${stepName}`,
                tool: 'adjust',
                params: { prompt: activePrompt }
            });
            setSelectedPresetPrompt(null);
            setCustomPrompt('');
        }
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Apply a Professional Adjustment</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {presets.map(preset => (
          <Tooltip key={preset.name} text={preset.prompt}>
            <button
              onClick={() => handlePresetClick(preset.prompt)}
              disabled={isLoading}
              className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
            >
              {preset.name}
            </button>
          </Tooltip>
        ))}
      </div>

      <Tooltip text="Describe any adjustment, e.g., 'Make the lighting more dramatic'">
        <input
          type="text"
          value={customPrompt}
          onChange={handleCustomChange}
          placeholder="Or describe an adjustment (e.g., 'change background to a forest')"
          className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
          disabled={isLoading}
        />
      </Tooltip>

      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <Tooltip text={mode === 'interactive' ? "Apply the selected adjustment" : "Add this adjustment to the recipe"}>
              <button
                  onClick={handleApply}
                  className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                  disabled={isLoading || !activePrompt.trim()}
              >
                  {mode === 'interactive' ? 'Apply Adjustment' : 'Add to Recipe'}
              </button>
            </Tooltip>
        </div>
      )}
    </div>
  );
};

export default AdjustmentPanel;