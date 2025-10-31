/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer, Tool } from '../types';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface BackgroundPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
}

type BackgroundTab = 'generate' | 'upload';

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<BackgroundTab>('generate');
  
  const handleApply = (params: any, name: string) => {
    if (mode === 'recipe' && onAddToRecipe) {
      onAddToRecipe({
        name,
        tool: 'background',
        params,
      });
    } else {
      onAddLayer({
        name,
        tool: 'background',
        params,
      });
    }
  }

  const handleApplyText = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      handleApply({ prompt: customPrompt }, `Фон: ${customPrompt.slice(0, 20)}...`);
      setCustomPrompt('');
    }
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      setBackgroundFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (backgroundFile) {
       handleApply({ backgroundDataUrl: backgroundPreview }, `Фон: Загруженное изображение`);
    }
  };

  const buttonText = mode === 'recipe' ? 'Добавить в рецепт' : 'Добавить слой';

  const renderContent = () => {
    switch(activeTab) {
      case 'generate':
        return (
          <form onSubmit={handleApplyText} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip side="left" text="Опишите новый фон, например, 'песчаный пляж на закате'">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Опишите фон..."
                className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                disabled={isLoading}
              />
            </Tooltip>
            <Tooltip side="left" text="Сгенерировать новый фон по вашему текстовому описанию">
              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                disabled={isLoading || !customPrompt.trim()}
              >
                {isLoading && activeTab === 'generate' ? <Spinner size="sm"/> : buttonText}
              </button>
            </Tooltip>
          </form>
        );
      case 'upload':
        return (
          <form onSubmit={handleApplyImage} className="flex flex-col gap-2 animate-fade-in">
            <Tooltip side="left" text="Загрузите изображение для использования в качестве нового фона">
              <label
                htmlFor="background-upload"
                className={`w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors ${isDraggingOver ? 'border-primary bg-primary/10 animate-pulse' : 'border-border-color'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleFileChange(e.dataTransfer.files?.[0] || null);
                }}
              >
                {backgroundPreview ? (
                  <img src={backgroundPreview} alt="Background preview" className="max-h-24 mx-auto rounded-md object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
                    <UploadIcon className="w-8 h-8" />
                    <span>Загрузить или перетащить</span>
                  </div>
                )}
              </label>
            </Tooltip>
            <input id="background-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />

            <Tooltip side="left" text="Применить загруженное изображение в качестве нового фона">
              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                disabled={isLoading || !backgroundFile}
              >
                {isLoading && activeTab === 'upload' ? <Spinner size="sm"/> : buttonText}
              </button>
            </Tooltip>
          </form>
        );
      default:
        return null;
    }
  }

  const tabs: { id: BackgroundTab, name: string }[] = [
    { id: 'generate', name: 'Сгенерировать' },
    { id: 'upload', name: 'Загрузить' },
  ];

  const tooltipTextMap: { [key in BackgroundTab]: string } = {
    generate: 'Изменить фон, сгенерировав его из текста',
    upload: 'Изменить фон, загрузив изображение'
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Изменить фон</h3>
      
      <div className="w-full bg-stone-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1">
          {tabs.map(tab => (
              <Tooltip side="left" key={tab.id} text={tooltipTextMap[tab.id]}>
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
        {renderContent()}
      </div>
    </div>
  );
};

export default BackgroundPanel;