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
import { Layer, Tool } from '../types';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface ExpandPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
}

type ExpandSize = 25 | 50;
type Direction = 'up' | 'down' | 'left' | 'right';

const ExpandPanel: React.FC<ExpandPanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [expandSize, setExpandSize] = useState<ExpandSize>(25);
  const [activeAction, setActiveAction] = useState<string | null>(null);


  const directionControls: { name: string; direction: Direction; icon: React.ReactNode }[] = [
    { name: 'Расширить вверх', direction: 'up', icon: <ArrowUpIcon className="w-8 h-8" /> },
    { name: 'Расширить вниз', direction: 'down', icon: <ArrowDownIcon className="w-8 h-8" /> },
    { name: 'Расширить влево', direction: 'left', icon: <ArrowLeftIcon className="w-8 h-8" /> },
    { name: 'Расширить вправо', direction: 'right', icon: <ArrowRightIcon className="w-8 h-8" /> },
  ];

  const handleApply = (params: any, name: string) => {
    setActiveAction(name);
    if (mode === 'recipe' && onAddToRecipe) {
      onAddToRecipe({
        name,
        tool: 'expand',
        params,
      });
    } else {
      onAddLayer({
        name,
        tool: 'expand',
        params,
      });
    }
  }

  const handleDirectionClick = (direction: Direction, name: string) => {
    handleApply({ direction, percentage: expandSize }, `${name} на ${expandSize}%`);
  };

  const handleUncropClick = () => {
    handleApply({ percentage: expandSize }, `Раскадрировать на ${expandSize}%`);
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Расширить холст</h3>
      <p className="text-sm text-center text-text-secondary -mt-2">Используйте ИИ для расширения изображения за его первоначальные границы.</p>
      
      <div className="flex flex-col items-center gap-4">
        {/* Size Selection */}
        <div className="flex items-center gap-2 bg-stone-100 rounded-lg p-1 border border-border-color">
          <span className="text-sm font-bold text-text-secondary pl-2">Расширить на:</span>
          {( [25, 50] as ExpandSize[] ).map(size => (
            <Tooltip side="left" key={size} text={`Расширить на ${size}%`}>
                <button
                    onClick={() => setExpandSize(size)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-base font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
                        expandSize === size 
                        ? 'bg-primary text-white shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    {size}%
                </button>
            </Tooltip>
          ))}
        </div>

        <Tooltip side="left" text={`Генеративно заполнить все стороны изображения, расширив его на ${expandSize}%`}>
            <button
                onClick={handleUncropClick}
                disabled={isLoading}
                className="w-full max-w-sm mt-2 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 h-[52px]"
            >
                {isLoading && activeAction?.includes('Uncrop') ? <Spinner size="sm" /> : <><ArrowsPointingOutIcon className="w-6 h-6" /> Раскадрировать</>}
            </button>
        </Tooltip>

        {/* Directional Controls */}
        <div className="w-full pt-2">
            <p className="text-sm text-center text-text-secondary mb-2">Или расширить в одном направлении:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {directionControls.map(({ name, direction, icon }) => (
                <Tooltip side="left" key={name} text={name}>
                    <button
                    onClick={() => handleDirectionClick(direction, name)}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center gap-2 w-full h-24 text-center bg-stone-50 text-text-primary border border-border-color font-semibold p-2 rounded-lg transition-all duration-200 ease-in-out hover:bg-stone-100 hover:border-stone-400 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {isLoading && activeAction?.includes(name) ? <Spinner /> : icon}
                    <span className="text-sm">{name.replace('Расширить ', '')}</span>
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