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

type Direction = 'up' | 'down' | 'left' | 'right';

const ExpandPanel: React.FC<ExpandPanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [expandSize, setExpandSize] = useState(25);
  const [prompt, setPrompt] = useState('');
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
    const layerName = `${name} на ${expandSize}%` + (prompt ? ` (${prompt.slice(0, 10)}...)` : '');
    handleApply({ direction, percentage: expandSize, prompt }, layerName);
  };

  const handleUncropClick = () => {
    const layerName = `Раскадрировать на ${expandSize}%` + (prompt ? ` (${prompt.slice(0, 10)}...)` : '');
    handleApply({ percentage: expandSize, prompt }, layerName);
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Расширить холст</h3>
      <p className="text-sm text-center text-text-secondary -mt-2">Используйте ИИ для расширения изображения за его первоначальные границы.</p>
      
      <div className="flex flex-col items-center gap-4">
        {/* Size Selection */}
        <div className="w-full max-w-sm flex flex-col gap-2 p-3 bg-stone-50 rounded-lg border border-border-color">
            <label htmlFor="expand-size" className="font-semibold text-center block">
                Расширить на: <span className="font-bold text-primary">{expandSize}%</span>
            </label>
            <Tooltip side="left" text="Выберите, на сколько процентов расширить холст.">
                <input 
                    id="expand-size"
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={expandSize}
                    onChange={(e) => setExpandSize(parseInt(e.target.value, 10))}
                    disabled={isLoading}
                    className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer"
                />
            </Tooltip>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-2">
            <Tooltip side="left" text="Необязательно: опишите, что добавить в новую область (например, 'добавить маяк вдалеке')">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Подсказка для содержимого (необязательно)..."
                    className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                    disabled={isLoading}
                />
            </Tooltip>
        </div>

        <Tooltip side="left" text={`Генеративно заполнить все стороны изображения, расширив его на ${expandSize}%`}>
            <button
                onClick={handleUncropClick}
                disabled={isLoading}
                className="w-full max-w-sm bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 h-[52px]"
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