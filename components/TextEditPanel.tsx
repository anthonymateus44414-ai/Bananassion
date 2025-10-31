/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip.tsx';
import { Layer } from '../types.ts';
import Spinner from './Spinner.tsx';

interface TextEditPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible' | 'cachedResult'>) => void;
  isLoading: boolean;
}

const TextEditPanel: React.FC<TextEditPanelProps> = ({ onAddLayer, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onAddLayer({
        name: `Текстовая правка: ${prompt.slice(0, 20)}...`,
        tool: 'textEdit',
        params: { prompt },
      });
      setPrompt('');
    }
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Текстовая правка</h3>
      <p className="text-sm text-center text-text-secondary -mt-2">Опишите любое изменение, которое вы хотите, чтобы ИИ внес в изображение.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Tooltip side="left" text="например, 'убрать человека на заднем плане', 'добавить ретро-фильтр', 'изменить цвет машины на красный'">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите вашу правку..."
            className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base resize-none h-32 font-medium"
            disabled={isLoading}
          />
        </Tooltip>
        <Tooltip side="left" text="Применить правку к изображению как новый слой">
          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? <Spinner size="sm" /> : 'Добавить слой'}
          </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default TextEditPanel;