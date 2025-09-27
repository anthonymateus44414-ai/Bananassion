/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { ArrowUpCircleIcon } from './icons';
import Tooltip from './Tooltip';
import { Tool } from '../types';

interface EnhancePanelProps {
  onApplyEnhancement: () => void;
  onApplyAreaEnhancement: (prompt: string) => void;
  editHotspot: { x: number, y: number } | null;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: any }) => void;
}

type EnhanceTab = 'full' | 'area';

const EnhancePanel: React.FC<EnhancePanelProps> = ({ onApplyEnhancement, onApplyAreaEnhancement, editHotspot, isLoading, mode = 'interactive', onAddToRecipe }) => {
  const [activeTab, setActiveTab] = useState<EnhanceTab>('full');
  const [prompt, setPrompt] = useState('');

  const handleAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && editHotspot) {
      onApplyAreaEnhancement(prompt);
    }
  };

  const handleEnhanceClick = () => {
    if (mode === 'interactive') {
      onApplyEnhancement();
    } else if (onAddToRecipe) {
      onAddToRecipe({
        name: 'Enhance Image',
        tool: 'enhance',
        params: {}
      });
    }
  }

  const renderFullImageContent = () => (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-sm text-gray-400 max-w-md text-center">
        Use AI to automatically increase resolution, sharpen details, and remove noise for a clearer, higher-quality image.
      </p>
      <Tooltip text={mode === 'interactive' ? "Automatically enhance the entire image" : "Add full image enhancement to the recipe"}>
        <button
          onClick={handleEnhanceClick}
          disabled={isLoading}
          className="w-full max-w-xs mt-2 bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          <ArrowUpCircleIcon className="w-6 h-6" />
          {mode === 'interactive' ? 'Enhance Full Image' : 'Add to Recipe'}
        </button>
      </Tooltip>
    </div>
  );

  const renderAreaContent = () => (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-md text-gray-400">
        {editHotspot ? 'Great! Now describe how to enhance the selected area.' : 'Click an area on the image to select it for enhancement.'}
      </p>
      <form onSubmit={handleAreaSubmit} className="w-full flex items-center gap-2">
        <Tooltip text="Describe the enhancement for the selected point, e.g., 'make the logo sharper'">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={editHotspot ? "e.g., 'make the eyes sharper'" : "First click a point on the image"}
              className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || !editHotspot}
            />
        </Tooltip>
        <Tooltip text="Apply the enhancement to the selected area">
            <button
              type="submit"
              className="bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
              disabled={isLoading || !prompt.trim() || !editHotspot}
            >
              Enhance
            </button>
        </Tooltip>
      </form>
    </div>
  );

  const tabs: { id: EnhanceTab, name: string }[] = [
    { id: 'full', name: 'Full Image' },
    { id: 'area', name: 'Specific Area' },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Enhance Image Quality</h3>
      
      {mode === 'interactive' && (
        <div className="w-full max-w-sm mx-auto bg-gray-900/40 rounded-lg p-1 flex items-center justify-center gap-1">
          {tabs.map(tab => (
            <Tooltip key={tab.id} text={`Enhance the ${tab.id === 'full' ? 'entire image' : 'specific, selected area'}`}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full capitalize font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                  activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.name}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      <div className="mt-2">
        {activeTab === 'full' || mode === 'recipe' ? renderFullImageContent() : renderAreaContent()}
      </div>
    </div>
  );
};

export default EnhancePanel;