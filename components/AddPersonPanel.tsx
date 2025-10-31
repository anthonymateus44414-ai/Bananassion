

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon } from './icons';
import Tooltip from './Tooltip';
import { Layer } from '../types';
import Spinner from './Spinner';

interface AddPersonPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
}

const AddPersonPanel: React.FC<AddPersonPanelProps> = ({ onAddLayer, isLoading }) => {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setPersonFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPersonPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personFile && prompt.trim()) {
      onAddLayer({
        name: `Add Person: ${prompt.slice(0, 20)}...`,
        tool: 'addPerson',
        params: { personDataUrl: personPreview, prompt }
      });
    }
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Добавить человека</h3>
      <p className="text-sm text-center text-text-secondary -mt-2">Загрузите эталонное изображение человека для добавления на сцену. ИИ автоматически удалит фон.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Tooltip side="left" text="Загрузите фото человека, которого хотите добавить. Его фон будет удален автоматически.">
          <label
            htmlFor="person-upload"
            className={`w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors ${isDraggingOver ? 'border-primary bg-primary/10 animate-pulse' : 'border-border-color'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              handleFileChange(e.dataTransfer.files?.[0] || null);
            }}
          >
            {personPreview ? (
              <img src={personPreview} alt="Person preview" className="max-h-32 mx-auto rounded-md object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-text-secondary">
                <UploadIcon className="w-8 h-8" />
                <span>Загрузить эталонное изображение</span>
              </div>
            )}
          </label>
        </Tooltip>
        <input id="person-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} disabled={isLoading} />
        
        <Tooltip side="left" text="Опишите размещение и масштаб, например, 'добавить ее стоящей слева, смотрящей в камеру'">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="например, 'добавить этого человека стоящим справа'"
              className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
              disabled={isLoading}
            />
        </Tooltip>

        <Tooltip side="left" text="Добавить человека с эталонного изображения на основную сцену">
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
              disabled={isLoading || !personFile || !prompt.trim()}
            >
              {isLoading ? <Spinner size="sm" /> : 'Добавить слой'}
            </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default AddPersonPanel;