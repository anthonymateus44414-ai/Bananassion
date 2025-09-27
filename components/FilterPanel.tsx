/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Tool, CustomStyle } from '../types';
import { XCircleIcon } from './icons';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { prompt: string } }) => void;
  customStyles?: CustomStyle[];
  onApplyCustomStyle?: (styleId: string) => void;
  onDeleteCustomStyle?: (styleId: string) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ 
    onApplyFilter, 
    isLoading, 
    mode = 'interactive', 
    onAddToRecipe,
    customStyles = [],
    onApplyCustomStyle,
    onDeleteCustomStyle,
}) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Synthwave', prompt: 'Apply a vibrant 80s synthwave aesthetic with neon magenta and cyan glows, and subtle scan lines.' },
    { name: 'Anime', prompt: 'Give the image a vibrant Japanese anime style, with bold outlines, cel-shading, and saturated colors.' },
    { name: 'Lomo', prompt: 'Apply a Lomography-style cross-processing film effect with high-contrast, oversaturated colors, and dark vignetting.' },
    { name: 'Glitch', prompt: 'Transform the image into a futuristic holographic projection with digital glitch effects and chromatic aberration.' },
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
            onApplyFilter(activePrompt);
        } else if (onAddToRecipe) {
            const selectedPreset = presets.find(p => p.prompt === selectedPresetPrompt);
            const stepName = selectedPreset?.name || `Custom: ${activePrompt.slice(0, 15)}...`;
            onAddToRecipe({
                name: `Filter: ${stepName}`,
                tool: 'filter',
                params: { prompt: activePrompt }
            });
            setSelectedPresetPrompt(null);
            setCustomPrompt('');
        }
    }
  };

  const hasCustomStyles = customStyles && customStyles.length > 0;

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Apply a Filter</h3>

      {mode === 'interactive' && hasCustomStyles && onApplyCustomStyle && (
        <>
            <div className="flex flex-col gap-2">
                <h4 className="text-md font-semibold text-gray-400">Your Styles</h4>
                <div className="grid grid-cols-2 gap-3">
                    {customStyles.map(style => (
                        <div key={style.id} className="relative group">
                            <Tooltip text={`Apply your custom '${style.name}' style`}>
                                <button
                                    onClick={() => onApplyCustomStyle(style.id)}
                                    disabled={isLoading}
                                    className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ring-offset-2 ring-offset-gray-800 focus:ring-blue-500"
                                >
                                    <img src={style.thumbnailUrl} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-sm font-semibold truncate text-left">{style.name}</p>
                                    </div>
                                </button>
                            </Tooltip>
                            {onDeleteCustomStyle && (
                                <Tooltip text="Delete style">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteCustomStyle(style.id);
                                        }}
                                        disabled={isLoading}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                        aria-label={`Delete style ${style.name}`}
                                    >
                                        <XCircleIcon className="w-5 h-5"/>
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-xs">OR</span>
                <div className="flex-grow border-t border-gray-700"></div>
            </div>
        </>
      )}
      
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
      <Tooltip text="Describe any filter, e.g., 'vintage black and white film'">
        <input
          type="text"
          value={customPrompt}
          onChange={handleCustomChange}
          placeholder="Or describe a custom filter (e.g., '80s synthwave glow')"
          className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
          disabled={isLoading}
        />
      </Tooltip>
      
      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
          <Tooltip text={mode === 'interactive' ? "Apply the selected or custom filter" : "Add this filter to the recipe"}>
            <button
              onClick={handleApply}
              className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
              disabled={isLoading || !activePrompt.trim()}
            >
              {mode === 'interactive' ? 'Apply Filter' : 'Add to Recipe'}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;