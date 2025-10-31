/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, CursorArrowRaysIcon, SparklesIcon } from './icons';
import Tooltip from './Tooltip';
import { Hotspot, Layer } from '../types';
import Spinner from './Spinner';

interface AddObjectPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  editHotspot: Hotspot | null;
}

type AddObjectTab = 'generate' | 'upload';

const AddObjectPanel: React.FC<AddObjectPanelProps> = ({ onAddLayer, isLoading, editHotspot }) => {
  const [prompt, setPrompt] = useState('');
  const [objectFile, setObjectFile] = useState<File | null>(null);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<AddObjectTab>('generate');
  const [lighting, setLighting] = useState('');
  const [shadows, setShadows] = useState('');

  const resetLocalState = () => {
      setPrompt('');
      setObjectFile(null);
      setObjectPreview(null);
      setLighting('');
      setShadows('');
  };

  const handleApplyText = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && editHotspot) {
      onAddLayer({
        name: `Add: ${prompt.slice(0, 20)}...`,
        tool: 'addObject',
        params: { prompt, hotspot: editHotspot, lighting, shadows }
      });
      resetLocalState();
    }
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      setObjectFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setObjectPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectFile && editHotspot) {
      onAddLayer({
        name: `Add: Uploaded Object`,
        tool: 'addObject',
        params: { objectDataUrl: objectPreview, hotspot: editHotspot, lighting, shadows }
      });
      resetLocalState();
    }
  };
  
  const isActionable = (activeTab === 'generate' && prompt.trim() !== '') || (activeTab === 'upload' && objectFile !== null);

  const renderAdvancedOptions = () => (
    <div className={`flex flex-col gap-3 my-2 transition-opacity duration-300 ${isActionable ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div className="relative flex items-center">
            <div className="flex-grow border-t border-border-color"></div>
            <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">Освещение и тени (необязательно)</span>
            <div className="flex-grow border-t border-border-color"></div>
        </div>
        <Tooltip side="left" text="Опишите, как должен быть освещен объект, например, 'освещен сверху слева', 'в мягком утреннем свете'">
            <input
                type="text"
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                placeholder="Инструкции по освещению..."
                className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-2.5 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                disabled={isLoading || !isActionable}
                aria-label="Инструкции по освещению"
            />
        </Tooltip>
        <Tooltip side="left" text="Опишите, какие тени должен отбрасывать объект, например, 'отбрасывает длинную, мягкую тень вправо'">
            <input
                type="text"
                value={shadows}
                onChange={(e) => setShadows(e.target.value)}
                placeholder="Инструкции по теням..."
                className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-2.5 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                disabled={isLoading || !isActionable}
                aria-label="Инструкции по теням"
            />
        </Tooltip>
    </div>
  );

  const renderContent = () => {
    switch(activeTab) {
      case 'generate':
        return (
          <form onSubmit={handleApplyText} className="flex flex-col gap-4 animate-fade-in">
            <Tooltip side="left" text="Опишите добавляемый объект. Будьте точны для лучших результатов (например, 'красный скутер Vespa 1960-х годов').">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="например, 'маленький кактус в горшке'"
                className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                disabled={isLoading}
              />
            </Tooltip>

            {prompt && (
              <div className="p-4 bg-stone-50 rounded-lg border border-border-color flex flex-col items-center text-center animate-fade-in">
                  <SparklesIcon className="w-10 h-10 text-primary mb-2"/>
                  <p className="text-xs text-text-secondary font-semibold">Сгенерированный объект:</p>
                  <p className="text-sm font-bold text-text-primary italic truncate w-full">"{prompt}"</p>
              </div>
            )}

            {renderAdvancedOptions()}
            
            <Tooltip side="left" text="Сгенерировать объект в выбранной точке">
              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                disabled={isLoading || !prompt.trim()}
              >
                {isLoading && activeTab === 'generate' ? <Spinner size="sm" /> : 'Добавить слой'}
              </button>
            </Tooltip>
          </form>
        );
      case 'upload':
        return (
          <form onSubmit={handleApplyImage} className="flex flex-col gap-4 animate-fade-in">
            {objectPreview ? (
                 <div className="p-2 bg-stone-50 rounded-lg border border-border-color animate-fade-in">
                    <img src={objectPreview} alt="Object preview" className="max-h-32 w-full mx-auto rounded-md object-contain" />
                </div>
            ) : (
                <Tooltip side="left" text="Загрузите изображение объекта для добавления. Его фон будет удален.">
                  <label
                    htmlFor="object-upload"
                    className={`w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors ${isDraggingOver ? 'border-primary bg-primary/10 animate-pulse' : 'border-border-color'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      handleFileChange(e.dataTransfer.files?.[0] || null);
                    }}
                  >
                      <div className="flex flex-col items-center gap-2 text-text-secondary">
                        <UploadIcon className="w-8 h-8" />
                        <span>Загрузить или перетащить</span>
                      </div>
                  </label>
                </Tooltip>
            )}
            <input id="object-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />
            
            {renderAdvancedOptions()}

            <Tooltip side="left" text="Добавить загруженный объект на сцену в выбранной точке">
              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                disabled={isLoading || !objectFile}
              >
                {isLoading && activeTab === 'upload' ? <Spinner size="sm" /> : 'Добавить слой'}
              </button>
            </Tooltip>
          </form>
        );
      default:
        return null;
    }
  }

  const tabs: { id: AddObjectTab, name: string }[] = [
    { id: 'generate', name: 'Сгенерировать' },
    { id: 'upload', name: 'Загрузить' },
  ];

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Добавить объект</h3>
      
      {!editHotspot ? (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center bg-stone-50 rounded-lg border-2 border-dashed border-border-color">
            <CursorArrowRaysIcon className="w-12 h-12 text-text-secondary" />
            <h4 className="font-bold text-text-primary">Выберите точку размещения</h4>
            <p className="text-sm text-text-secondary">Кликните в любом месте на изображении, чтобы выбрать, куда добавить объект.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
            <div className="p-3 bg-stone-100 rounded-lg border border-border-color text-center">
                <h4 className="text-sm font-bold text-text-primary">Точка размещения выбрана</h4>
                <p className="text-xs text-text-secondary font-mono">X: {editHotspot.x.toFixed(1)}%, Y: {editHotspot.y.toFixed(1)}%</p>
            </div>
      
            <div className="w-full bg-stone-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1">
                {tabs.map(tab => (
                    <Tooltip side="left" key={tab.id} text={`Добавить объект, ${tab.id === 'generate' ? 'сгенерировав его из текста' : 'загрузив фото'}`}>
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
      )}
    </div>
  );
};

export default AddObjectPanel;
