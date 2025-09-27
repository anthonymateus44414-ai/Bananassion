/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { 
    ArrowUpIcon, 
    ArrowDownIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon,
    ArrowsPointingOutIcon
} from './icons';
import Tooltip from './Tooltip';
import { Tool } from '../types';

interface ExpandPanelProps {
  onApplyExpansion: (direction: 'up' | 'down' | 'left' | 'right', percentage: number) => void;
  onApplyUncrop: (percentage: number) => void;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { direction: Direction, percentage: ExpandSize } }) => void;
}

type ExpandSize = 25 | 50;
type Direction = 'up' | 'down' | 'left' | 'right';

const ExpandPanel: React.FC<ExpandPanelProps> = ({ onApplyExpansion, onApplyUncrop, isLoading, mode = 'interactive', onAddToRecipe }) => {
  const [expandSize, setExpandSize] = useState<ExpandSize>(25);

  const directionControls: { name: string; direction: Direction; icon: React.ReactNode }[] = [
    { name: 'Expand Up', direction: 'up', icon: <ArrowUpIcon className="w-8 h-8" /> },
    { name: 'Expand Down', direction: 'down', icon: <ArrowDownIcon className="w-8 h-8" /> },
    { name: 'Expand Left', direction: 'left', icon: <ArrowLeftIcon className="w-8 h-8" /> },
    { name: 'Expand Right', direction: 'right', icon: <ArrowRightIcon className="w-8 h-8" /> },
  ];

  const handleClick = (direction: Direction, name: string) => {
    if (mode === 'interactive') {
      onApplyExpansion(direction, expandSize);
    } else if (onAddToRecipe) {
      onAddToRecipe({
        name: `${name} by ${expandSize}%`,
        tool: 'expand',
        params: { direction, percentage: expandSize }
      });
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Expand Canvas</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Use AI to expand the image beyond its original borders.</p>
      
      <div className="flex flex-col items-center gap-4">
        {/* Size Selection */}
        <div className="flex items-center gap-2 bg-gray-900/40 rounded-lg p-1">
          <span className="text-sm font-medium text-gray-400 pl-2">Expand by:</span>
          {( [25, 50] as ExpandSize[] ).map(size => (
            <Tooltip key={size} text={`Expand by ${size}%`}>
                <button
                    onClick={() => setExpandSize(size)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                        expandSize === size 
                        ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-white/10 hover:bg-white/20 text-gray-200'
                    }`}
                >
                    {size}%
                </button>
            </Tooltip>
          ))}
        </div>

        {mode === 'interactive' && (
            <Tooltip text={`Generatively fill all sides of the image, expanding it by ${expandSize}%`}>
                <button
                    onClick={() => onApplyUncrop(expandSize)}
                    disabled={isLoading}
                    className="w-full max-w-sm mt-2 bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                >
                    <ArrowsPointingOutIcon className="w-6 h-6" />
                    Uncrop / Outpaint
                </button>
            </Tooltip>
        )}

        {/* Directional Controls */}
        <div className="w-full pt-2">
            <p className="text-sm text-center text-gray-400 mb-2">{mode === 'interactive' ? 'Or expand in a single direction:' : 'Select a direction to add to the recipe:'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {directionControls.map(({ name, direction, icon }) => (
                <Tooltip key={name} text={name}>
                    <button
                    onClick={() => handleClick(direction, name)}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center gap-2 w-full h-24 text-center bg-white/10 border border-transparent text-gray-200 font-semibold p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {icon}
                    <span className="text-sm">{name.replace('Expand ', '')}</span>
                    </button>
                </Tooltip>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExpandPanel;