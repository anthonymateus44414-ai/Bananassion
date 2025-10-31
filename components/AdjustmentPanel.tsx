/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Tool, Layer } from '../types';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface AdjustmentPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Размыть фон', prompt: 'Примените реалистичный эффект глубины резкости, сделав фон размытым, при этом сохраняя главный объект в фокусе.' },
    { name: 'Усилить детали', prompt: 'Немного увеличьте резкость и детализацию изображения, не делая его неестественным.' },
    { name: 'Сделать светлее', prompt: 'Слегка осветлите изображение в целом, чтобы оно выглядело более ярким и хорошо освещенным, сохраняя при этом естественные цвета.' },
    { name: 'Увеличить контраст', prompt: 'Увеличьте контраст, чтобы изображение стало более выразительным и динамичным, не теряя деталей в тенях и светах.' },
    { name: 'Усилить насыщенность', prompt: 'Умеренно увеличьте насыщенность цветов по всему изображению, чтобы сделать цвета богаче и ярче, но избегайте неестественного вида.' },
    { name: 'Теплое освещение', prompt: 'Отрегулируйте цветовую температуру, чтобы придать изображению более теплое освещение в стиле "золотого часа".' },
    { name: 'Холодные тона', prompt: 'Отрегулируйте цветовой баланс, чтобы придать изображению более холодный, кинематографичный вид с акцентом на синие и голубые тона.' },
    { name: 'Студийный свет', prompt: 'Добавьте драматическое, профессиональное студийное освещение на главный объект.' },
    { name: 'Эффект HDR', prompt: 'Примените к изображению эффект высокого динамического диапазона (HDR), улучшая детализацию как в тенях, так и в светах для более драматичного и яркого вида.' },
    { name: 'Убрать дымку', prompt: 'Удалите дымку или туман с изображения, увеличив четкость и контраст для более резкого вида.' },
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
        const selectedPreset = presets.find(p => p.prompt === selectedPresetPrompt);
        const name = selectedPreset?.name || `Custom: ${activePrompt.slice(0, 15)}...`;
        const stepName = `Коррекция: ${name}`;

        if (mode === 'recipe' && onAddToRecipe) {
          onAddToRecipe({
            name: stepName,
            tool: 'adjust',
            params: { prompt: activePrompt }
          });
        } else {
          onAddLayer({
              name: stepName,
              tool: 'adjust',
              params: { prompt: activePrompt }
          });
        }
        setSelectedPresetPrompt(null);
        setCustomPrompt('');
    }
  };

  const buttonText = mode === 'recipe' ? 'Добавить в рецепт' : 'Добавить слой';

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Коррекция</h3>
      
      <div className="grid grid-cols-2 gap-2">
        {presets.map(preset => (
          <Tooltip side="left" key={preset.name} text={preset.prompt}>
            <button
              onClick={() => handlePresetClick(preset.prompt)}
              disabled={isLoading}
              className={`w-full text-center font-bold py-3 px-2 border rounded-lg transition-all duration-200 ease-in-out active:scale-[0.98] text-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'bg-primary text-white border-transparent' : 'bg-gray-50 text-text-primary border-border-color hover:bg-gray-100 hover:border-gray-400'}`}
            >
              {preset.name}
            </button>
          </Tooltip>
        ))}
      </div>

      <Tooltip side="left" text="Опишите любую коррекцию, например, 'сделать освещение более драматичным'">
        <input
          type="text"
          value={customPrompt}
          onChange={handleCustomChange}
          placeholder="Или опишите коррекцию..."
          className="flex-grow bg-gray-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
          disabled={isLoading}
        />
      </Tooltip>

      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <Tooltip side="left" text={`Применить выбранную коррекцию как новый ${mode === 'recipe' ? 'шаг рецепта' : 'слой'}`}>
              <button
                  onClick={handleApply}
                  className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
                  disabled={isLoading || !activePrompt.trim()}
              >
                  {isLoading ? <Spinner size="sm" /> : buttonText}
              </button>
            </Tooltip>
        </div>
      )}
    </div>
  );
};

export default AdjustmentPanel;