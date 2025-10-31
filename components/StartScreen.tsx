/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, SparklesIcon } from './icons';
import Tooltip from './Tooltip';
import Spinner from './Spinner';

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onGenerateFromPrompt: (prompt: string) => void;
  isLoading: boolean;
}

type Tab = 'edit' | 'generate';

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onGenerateFromPrompt, isLoading }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [prompt, setPrompt] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };
  
  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerateFromPrompt(prompt);
    }
  };

  const renderEditContent = () => (
    <div 
      className={`relative mt-6 transition-all duration-300 p-8 border-2 border-dashed rounded-xl ${isDraggingOver ? 'bg-primary/10 border-primary animate-pulse' : 'border-border-color'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onFileSelect(e.dataTransfer.files);
      }}
    >
        <div className="flex flex-col items-center gap-4">
            <Tooltip text="Выберите одно или несколько изображений с вашего устройства, чтобы начать редактирование">
                <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-xl font-bold text-white bg-primary rounded-lg cursor-pointer group hover:bg-primary-hover transition-colors active:scale-[0.98] shadow-lg hover:shadow-xl">
                    <UploadIcon className="w-7 h-7 mr-3" />
                    Загрузить изображение(я)
                </label>
            </Tooltip>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} multiple />
            <p className="text-sm text-text-secondary font-semibold">или перетащите файл(ы)</p>
        </div>
    </div>
  );

  const renderGenerateContent = () => (
    <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-2xl">
        <p className="text-lg text-text-secondary font-semibold">Опишите изображение, которое вы хотите создать из своего воображения.</p>
        <form onSubmit={handleGenerateSubmit} className="w-full flex flex-col items-center gap-4">
            <Tooltip text="Введите подробное описание изображения для генерации">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="например, Счастливый маленький робот машет рукой, в стиле цифрового искусства..."
                    className="w-full bg-bg-panel border-2 border-border-color text-text-primary rounded-lg p-4 text-lg focus:ring-2 ring-primary focus:outline-none transition h-32 resize-none font-medium"
                    disabled={isLoading}
                    aria-label="Подсказка для генерации изображения"
                />
            </Tooltip>
            <Tooltip text="Создать новое изображение по вашему текстовому описанию">
                <button 
                    type="submit"
                    className="relative inline-flex items-center justify-center px-8 py-4 text-xl font-bold text-white bg-primary rounded-lg cursor-pointer group hover:bg-primary-hover transition-colors active:scale-[0.98] shadow-lg hover:shadow-xl disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none h-[68px] w-56"
                    disabled={isLoading || !prompt.trim()}
                >
                    {isLoading ? <Spinner /> : <><SparklesIcon className="w-7 h-7 mr-3" /> Создать!</>}
                </button>
            </Tooltip>
        </form>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto text-center p-8">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-5xl md:text-6xl text-text-primary font-extrabold leading-tight">
          AI Фоторедактор и <span className="text-primary">Создатель!</span>
        </h1>
        <p className="max-w-3xl text-lg text-text-secondary md:text-xl font-semibold">
            Ретушируйте фотографии, создавайте новые изображения, применяйте творческие фильтры или делайте профессиональные настройки, используя простые текстовые подсказки.
        </p>

        <div className="w-full max-w-sm bg-gray-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1 mt-6">
            <Tooltip text="Переключиться в режим редактирования фото">
                <button
                    onClick={() => setActiveTab('edit')}
                    className={`w-full font-bold py-2.5 px-5 transition-all duration-200 text-lg rounded-md ${
                        activeTab === 'edit' 
                        ? 'bg-primary text-white shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary bg-transparent'
                    }`}
                >
                    Редактировать фото
                </button>
            </Tooltip>
            <Tooltip text="Переключиться в режим генерации изображений">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`w-full font-bold py-2.5 px-5 transition-all duration-200 text-lg rounded-md ${
                        activeTab === 'generate' 
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary bg-transparent'
                    }`}
                >
                    Создать изображение
                </button>
            </Tooltip>
        </div>
        
        {activeTab === 'edit' ? renderEditContent() : renderGenerateContent()}

        <div className="mt-16 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-bg-panel p-6 rounded-xl shadow-lg flex flex-col items-center text-center border border-border-color">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 text-primary rounded-full mb-4">
                       <MagicWandIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Точная ретушь</h3>
                    <p className="mt-2 text-text-secondary font-medium">Кликните в любую точку на изображении, чтобы удалить, изменить цвета или добавить элементы с высокой точностью.</p>
                </div>
                <div className="bg-bg-panel p-6 rounded-xl shadow-lg flex flex-col items-center text-center border border-border-color">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 text-primary rounded-full mb-4">
                       <PaletteIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Творческие фильтры</h3>
                    <p className="mt-2 text-text-secondary font-medium">Преобразуйте фотографии с помощью художественных стилей. От винтажных до футуристических, найдите или создайте идеальный фильтр.</p>
                </div>
                <div className="bg-bg-panel p-6 rounded-xl shadow-lg flex flex-col items-center text-center border border-border-color">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 text-primary rounded-full mb-4">
                       <SunIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">Про-настройки</h3>
                    <p className="mt-2 text-text-secondary font-medium">Улучшайте освещение, размывайте фон или меняйте настроение. Получайте результаты студийного качества без сложных инструментов.</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default StartScreen;