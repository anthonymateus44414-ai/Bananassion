/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { SparklesIcon, MagnifyingGlassPlusIcon, SunIcon, PaintBrushIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer, Hotspot, Tool } from '../types';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface EnhancePanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  editHotspot: Hotspot | null;
  isLoading: boolean;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
}

interface EnhancePreset {
    name: string;
    description: string;
    prompt: string | undefined;
    icon: React.ReactNode;
}

type EnhanceTab = 'full' | 'area';

const EnhancePanel: React.FC<EnhancePanelProps> = ({ onAddLayer, editHotspot, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [activeTab, setActiveTab] = useState<EnhanceTab>('full');
  const [prompt, setPrompt] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handleAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && editHotspot) {
      const stepName = `Улучшить область: ${prompt.slice(0, 15)}...`;
      setActivePreset(stepName);
      if (mode === 'recipe' && onAddToRecipe) {
        onAddToRecipe({
          name: stepName,
          tool: 'enhance',
          params: { prompt, hotspot: editHotspot },
        });
      } else {
        onAddLayer({
          name: stepName,
          tool: 'enhance',
          params: { prompt, hotspot: editHotspot }
        });
      }
    }
  };

  const handleEnhanceClick = (preset: EnhancePreset) => {
    const stepName = `Улучшить: ${preset.name}`;
    setActivePreset(preset.name);
    const params = preset.prompt ? { prompt: preset.prompt } : {};
    if (mode === 'recipe' && onAddToRecipe) {
      onAddToRecipe({ name: stepName, tool: 'enhance', params });
    } else {
      onAddLayer({ name: stepName, tool: 'enhance', params });
    }
  }

  const presets: EnhancePreset[] = [
    { name: 'Автоулучшение', description: 'Автоматически улучшить резкость, цвет и четкость по всему изображению.', prompt: undefined, icon: <SparklesIcon className="w-7 h-7 text-primary" /> },
    { name: 'Увеличить и заострить', description: 'Увеличить разрешение изображения и повысить резкость мелких деталей для более четкого изображения.', prompt: 'Увеличить разрешение изображения в 2 раза и повысить резкость деталей, сделав его более четким и определенным.', icon: <MagnifyingGlassPlusIcon className="w-7 h-7 text-primary" /> },
    { name: 'Уменьшить шум', description: 'Очистить цифровой шум и зернистость, особенно в темных областях, для более гладкого вида.', prompt: 'Проанализировать изображение на наличие цифрового шума и зернистости, особенно в тенях и на однородных цветах, и интеллектуально удалить его, сохранив ключевые детали.', icon: <PaintBrushIcon className="w-7 h-7 text-primary" /> },
    { name: 'Исправить освещение', description: 'Улучшить общее освещение, контраст и динамический диапазон, чтобы изображение "заиграло".', prompt: 'Улучшить освещение и контраст изображения. Сбалансировать света и тени, чтобы выделить объект и создать более динамичную, хорошо освещенную сцену.', icon: <SunIcon className="w-7 h-7 text-primary" /> },
  ];

  const renderFullImageContent = () => (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-sm text-text-secondary max-w-md text-center">
        Выберите улучшение в один клик для повышения общего качества вашего изображения.
      </p>
      <div className="w-full grid grid-cols-2 gap-3 mt-2">
          {presets.map(preset => (
            <Tooltip side="left" key={preset.name} text={preset.description}>
                <button
                onClick={() => handleEnhanceClick(preset)}
                disabled={isLoading}
                className="w-full h-28 flex flex-col items-center justify-center gap-2 text-center font-bold p-2 border rounded-lg transition-all duration-200 ease-in-out active:scale-[0.98] text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-stone-50 text-text-primary border-border-color hover:bg-stone-100 hover:border-stone-400"
                >
                {isLoading && activePreset === preset.name ? <Spinner /> : preset.icon}
                <span>{preset.name}</span>
                </button>
            </Tooltip>
          ))}
      </div>
    </div>
  );

  const renderAreaContent = () => (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-md text-text-secondary">
        {editHotspot ? 'Отлично! Теперь опишите, как улучшить выбранную область.' : 'Кликните на область на изображении, чтобы выбрать ее для улучшения.'}
      </p>
      <form onSubmit={handleAreaSubmit} className="w-full flex flex-col items-center gap-2">
        <Tooltip side="left" text="Опишите улучшение для выбранной точки, например, 'сделать логотип более резким'">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={editHotspot ? "например, 'сделать глаза более резкими'" : "Сначала кликните точку на изображении"}
              className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
              disabled={isLoading || !editHotspot}
            />
        </Tooltip>
        <Tooltip side="left" text="Применить улучшение к выбранной области">
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
              disabled={isLoading || !prompt.trim() || !editHotspot}
            >
              {isLoading && activeTab === 'area' ? <Spinner size="sm" /> : 'Улучшить область'}
            </button>
        </Tooltip>
      </form>
    </div>
  );

  const tabs: { id: EnhanceTab, name: string }[] = [
    { id: 'full', name: 'Все изображение' },
    { id: 'area', name: 'Конкретная область' },
  ];

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Улучшить качество изображения</h3>
      
      <div className="w-full max-w-sm mx-auto bg-stone-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1">
        {tabs.map(tab => (
          <Tooltip side="left" key={tab.id} text={`Улучшить ${tab.id === 'full' ? 'все изображение' : 'конкретную, выбранную область'}`}>
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`w-full capitalize font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.name}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === 'full' ? renderFullImageContent() : renderAreaContent()}
      </div>
    </div>
  );
};

export default EnhancePanel;