/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import Tooltip from './Tooltip';
import { Layer, CustomStyle, Tool, FilterSuggestion } from '../types';
import { XCircleIcon, SparklesIcon } from './icons';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface FilterPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  customStyles?: CustomStyle[];
  onApplyCustomStyle?: (styleId: string) => void;
  onDeleteCustomStyle?: (styleId: string) => void;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
  onGenerateSuggestions?: () => Promise<FilterSuggestion[]>;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ 
    onAddLayer, 
    isLoading, 
    customStyles = [],
    onApplyCustomStyle,
    onDeleteCustomStyle,
    onAddToRecipe,
    mode = 'layer',
    onGenerateSuggestions,
}) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<FilterSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  useEffect(() => {
    if (onGenerateSuggestions) {
        const fetchSuggestions = async () => {
            setIsSuggestionsLoading(true);
            setSuggestions([]); // Clear old suggestions
            const newSuggestions = await onGenerateSuggestions();
            setSuggestions(newSuggestions);
            setIsSuggestionsLoading(false);
        };
        fetchSuggestions();
    }
  }, [onGenerateSuggestions]);

  const presets = [
    { name: 'Винтажная пленка', prompt: 'Придайте изображению выцветший вид винтажной пленки с теплыми тонами, низким контрастом и легкой зернистостью, напоминающей фотографию 1970-х годов.' },
    { name: 'Кинематографичный', prompt: 'Примените кинематографичный вид с цветокоррекцией в стиле "teal and orange", легкой десатурацией и драматичными тенями.' },
    { name: 'Фильм нуар', prompt: 'Преобразуйте изображение в высококонтрастный черно-белый стиль фильма нуар с глубокими тенями и драматичным освещением.' },
    { name: 'Киберпанк', prompt: 'Погрузите изображение в мир киберпанка с яркими неоновыми синими и пурпурными цветами, отражающими поверхностями и футуристической, мрачной атмосферой.' },
    { name: 'Акварель', prompt: 'Превратите фотографию в нежную акварельную картину с мягкими, растекающимися цветами и эффектом текстурированной бумаги.' },
    { name: 'Мечтательное свечение', prompt: 'Добавьте мягкое, мечтательное свечение на изображение с пастельными бликами, низким контрастом и слегка размытым, эфирным качеством.' },
    { name: 'Синтвейв', prompt: 'Примените яркую эстетику синтвейва 80-х с неоновыми пурпурными и голубыми свечениями и тонкими линиями развертки.' },
    { name: 'Аниме', prompt: 'Придайте изображению яркий стиль японского аниме с жирными контурами, сел-шейдингом и насыщенными цветами.' },
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
        const selectedPreset = presets.find(p => p.prompt === selectedPresetPrompt) || suggestions.find(s => s.prompt === selectedPresetPrompt);
        const name = selectedPreset?.name || `Custom: ${activePrompt.slice(0, 15)}...`;
        const stepName = `Фильтр: ${name}`;
        
        if (mode === 'recipe' && onAddToRecipe) {
          onAddToRecipe({
            name: stepName,
            tool: 'filter',
            params: { prompt: activePrompt }
          });
        } else {
          onAddLayer({
              name: stepName,
              tool: 'filter',
              params: { prompt: activePrompt }
          });
        }
        setSelectedPresetPrompt(null);
        setCustomPrompt('');
    }
  };

  const hasCustomStyles = customStyles && customStyles.length > 0;
  const buttonText = mode === 'recipe' ? 'Добавить в рецепт' : 'Добавить слой';

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Фильтры</h3>

      {hasCustomStyles && onApplyCustomStyle && (
        <>
            <div className="flex flex-col gap-2">
                <h4 className="text-md font-bold text-text-secondary">Ваши стили</h4>
                <div className="grid grid-cols-3 gap-3">
                    {customStyles.map(style => {
                        const tooltipText = style.description
                            ? `'${style.name}' - Описание ИИ: ${style.description}`
                            : `Применить ваш пользовательский стиль '${style.name}'`;

                        return (
                            <div key={style.id} className="relative group">
                                <Tooltip side="left" text={tooltipText}>
                                    <button
                                        onClick={() => onApplyCustomStyle(style.id)}
                                        disabled={isLoading}
                                        className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ring-offset-2 ring-offset-white ring-primary border border-border-color"
                                    >
                                        <img src={style.thumbnailUrl} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                            <p className="text-white text-xs font-bold truncate text-left">{style.name}</p>
                                        </div>
                                    </button>
                                </Tooltip>
                                {onDeleteCustomStyle && (
                                    <Tooltip side="left" text="Удалить стиль">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteCustomStyle(style.id);
                                            }}
                                            disabled={isLoading}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white"
                                            aria-label={`Удалить стиль ${style.name}`}
                                        >
                                            <XCircleIcon className="w-4 h-4"/>
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border-color"></div>
                <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">ИЛИ</span>
                <div className="flex-grow border-t border-border-color"></div>
            </div>
        </>
      )}

      {onGenerateSuggestions && (isSuggestionsLoading || suggestions.length > 0) && (
        <>
            <div className="flex flex-col gap-2">
                <h4 className="text-md font-bold text-text-secondary flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-primary" />
                    Предложения ИИ
                </h4>
                <div className="grid grid-cols-1 gap-2">
                {isSuggestionsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="w-full h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))
                ) : (
                    suggestions.map(suggestion => (
                        <Tooltip side="left" key={suggestion.name} text={suggestion.prompt}>
                            <button
                                onClick={() => handlePresetClick(suggestion.prompt)}
                                disabled={isLoading}
                                className={`w-full text-left font-bold py-3 px-4 border rounded-lg transition-all duration-200 ease-in-out active:scale-[0.98] text-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === suggestion.prompt ? 'bg-primary text-white border-transparent' : 'bg-gray-50 text-text-primary border-border-color hover:bg-gray-100 hover:border-gray-400'}`}
                            >
                                {suggestion.name}
                            </button>
                        </Tooltip>
                    ))
                )}
                </div>
            </div>
            <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border-color"></div>
                <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">ИЛИ</span>
                <div className="flex-grow border-t border-border-color"></div>
            </div>
        </>
      )}
      
      <h4 className="text-md font-bold text-text-secondary">Пресеты</h4>
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
      <Tooltip side="left" text="Опишите любой фильтр, например, 'винтажная черно-белая пленка'">
        <input
          type="text"
          value={customPrompt}
          onChange={handleCustomChange}
          placeholder="Или опишите свой фильтр..."
          className="flex-grow bg-gray-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
          disabled={isLoading}
        />
      </Tooltip>
      
      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
          <Tooltip side="left" text={`Применить выбранный фильтр как новый ${mode === 'recipe' ? 'шаг рецепта' : 'слой'}`}>
            <button
              onClick={handleApply}
              className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
              disabled={isLoading || !activePrompt.trim()}
            >
              {isLoading ? <Spinner size="sm"/> : buttonText}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;