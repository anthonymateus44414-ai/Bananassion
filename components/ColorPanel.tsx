/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Layer, Tool } from '../types';
import { PaintBrushIcon } from './icons';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface ColorPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
  adjustments: { hue: number; saturation: number; brightness: number; };
  onAdjustmentsChange: (adjustments: { hue: number; saturation: number; brightness: number; }) => void;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
}

const ColorPanel: React.FC<ColorPanelProps> = ({ 
  onAddLayer,
  isLoading, 
  maskDataUrl,
  onToggleMasking,
  adjustments,
  onAdjustmentsChange,
  onAddToRecipe,
  mode = 'layer',
}) => {
  const [isAreaMode, setIsAreaMode] = useState(false);
  const { hue, saturation, brightness } = adjustments;

  const handleApply = () => {
    const adjustmentsText = [];
    if (hue !== 0) adjustmentsText.push(`Оттенок: ${hue > 0 ? '+' : ''}${hue}`);
    if (saturation !== 0) adjustmentsText.push(`Насыщенность: ${saturation > 0 ? '+' : ''}${saturation}`);
    if (brightness !== 0) adjustmentsText.push(`Яркость: ${brightness > 0 ? '+' : ''}${brightness}`);
    
    if (adjustmentsText.length > 0) {
      const prompt = `Примените следующие коррекции: ${adjustmentsText.join(', ')}.`;
      const stepName = `Цвет: ${adjustmentsText.join(', ')}`;
      const params = { prompt, mask: isAreaMode ? maskDataUrl : null };

      if (mode === 'recipe' && onAddToRecipe) {
        onAddToRecipe({ name: stepName, tool: 'color', params });
      } else {
        onAddLayer({ name: stepName, tool: 'color', params });
      }
    }
  };

  const isChanged = hue !== 0 || saturation !== 0 || brightness !== 0;
  const canApply = !isChanged || (isAreaMode && !maskDataUrl);
  const buttonText = mode === 'recipe' ? 'Добавить в рецепт' : 'Добавить слой';

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-6 flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col items-center">
        <h3 className="text-xl font-bold text-text-primary">Настройки цвета</h3>
        <div className="mt-2 w-full max-w-sm bg-stone-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1">
            <Tooltip side="left" text="Применить коррекцию ко всему изображению">
              <button
                  onClick={() => setIsAreaMode(false)}
                  className={`w-full font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                      !isAreaMode
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                  Глобально
              </button>
            </Tooltip>
            <Tooltip side="left" text="Применить коррекцию только к выбранной области">
                <button
                    onClick={() => setIsAreaMode(true)}
                    className={`w-full font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                        isAreaMode
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Выбранная область
                </button>
            </Tooltip>
        </div>
      </div>
      
      {isAreaMode && (
          <div className="flex flex-col items-center gap-2 p-3 bg-stone-50 border border-border-color rounded-lg -my-2">
              <p className="text-sm text-text-secondary text-center">
                  {maskDataUrl ? 'Область выбрана. Нажмите "Применить", чтобы продолжить.' : 'Область не выбрана.'}
              </p>
              <Tooltip side="left" text={maskDataUrl ? "Перерисовать выделенную область" : "Выбрать область для редактирования"}>
                  <button
                      onClick={onToggleMasking}
                      className="flex items-center gap-2 bg-secondary hover:bg-[#4B5563] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                      <PaintBrushIcon className="w-5 h-5"/>
                      {maskDataUrl ? 'Выбрать заново' : 'Выбрать область'}
                  </button>
              </Tooltip>
          </div>
      )}
      
      <div className="w-full flex flex-col gap-4">
          {/* Hue Slider */}
          <div className="flex items-center gap-3">
              <label htmlFor="hue" className="text-sm font-medium text-text-primary w-20">Оттенок</label>
              <Tooltip side="left" text={`Оттенок: ${hue}. Изменяет цветовой тон изображения.`}>
                <input
                    id="hue"
                    type="range"
                    min="-100"
                    max="100"
                    value={hue}
                    onChange={(e) => onAdjustmentsChange({ ...adjustments, hue: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                    style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                />
              </Tooltip>
              <span className="text-sm font-mono text-text-primary w-10 text-center">{hue}</span>
          </div>

          {/* Saturation Slider */}
          <div className="flex items-center gap-3">
              <label htmlFor="saturation" className="text-sm font-medium text-text-primary w-20">Насыщенность</label>
              <Tooltip side="left" text={`Насыщенность: ${saturation}. Изменяет интенсивность цвета.`}>
                <input
                    id="saturation"
                    type="range"
                    min="-100"
                    max="100"
                    value={saturation}
                    onChange={(e) => onAdjustmentsChange({ ...adjustments, saturation: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #808080, hsl(${hue * 1.8}, 100%, 50%))` }}
                />
              </Tooltip>
              <span className="text-sm font-mono text-text-primary w-10 text-center">{saturation}</span>
          </div>

          {/* Brightness Slider */}
          <div className="flex items-center gap-3">
              <label htmlFor="brightness" className="text-sm font-medium text-text-primary w-20">Яркость</label>
              <Tooltip side="left" text={`Яркость: ${brightness}. Изменяет общую светлоту изображения.`}>
                <input
                    id="brightness"
                    type="range"
                    min="-100"
                    max="100"
                    value={brightness}
                    onChange={(e) => onAdjustmentsChange({ ...adjustments, brightness: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                    style={{ background: 'linear-gradient(to right, black, white)' }}
                />
              </Tooltip>
              <span className="text-sm font-mono text-text-primary w-10 text-center">{brightness}</span>
          </div>
      </div>

      <div className="w-full flex items-center justify-center gap-3 mt-2">
          <Tooltip side="left" text={`Применить коррекцию цвета как новый ${mode === 'recipe' ? 'шаг рецепта' : 'слой'}`}>
              <button
                  onClick={handleApply}
                  disabled={isLoading || canApply}
                  className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
              >
                  {isLoading ? <Spinner size="sm" /> : buttonText}
              </button>
          </Tooltip>
      </div>
    </div>
  );
};

export default ColorPanel;