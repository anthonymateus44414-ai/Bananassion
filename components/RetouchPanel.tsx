/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon } from './icons';
import { Layer } from '../types';
import Spinner from './Spinner';

interface RetouchPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
}

const RetouchPanel: React.FC<RetouchPanelProps> = ({ 
  onAddLayer, 
  isLoading,
  maskDataUrl,
  onToggleMasking
}) => {
    const [retouchPrompt, setRetouchPrompt] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (maskDataUrl && retouchPrompt.trim()) {
            onAddLayer({
              name: `Ретушь: ${retouchPrompt.slice(0, 20)}...`,
              tool: 'retouch',
              params: { prompt: retouchPrompt, mask: maskDataUrl }
            });
            setRetouchPrompt('');
        }
    };

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Ретушь области</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">
                {maskDataUrl ? "Область выбрана. Опишите изменение ниже." : "Выберите область на изображении для редактирования."}
            </p>

            <div className="flex flex-col items-center gap-4">
                <Tooltip side="left" text={maskDataUrl ? "Перерисовать выделенную область" : "Выбрать область для редактирования"}>
                    <button
                        onClick={onToggleMasking}
                        className="flex items-center gap-2 bg-secondary hover:bg-[#4B5563] text-white font-bold py-3 px-5 rounded-lg transition-colors text-base"
                        disabled={isLoading}
                    >
                        <PaintBrushIcon className="w-5 h-5"/>
                        {maskDataUrl ? 'Выбрать заново' : 'Выбрать область'}
                    </button>
                </Tooltip>

                {maskDataUrl && (
                    <div className="w-24 h-24 border-2 border-border-color rounded-md p-1 bg-stone-100">
                        <img src={maskDataUrl} alt="Mask preview" className="w-full h-full object-contain" />
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2">
                   <Tooltip side="left" text="Опишите изменение, например, 'удалить машину', 'изменить цвет рубашки на синий'">
                        <input
                            type="text"
                            value={retouchPrompt}
                            onChange={(e) => setRetouchPrompt(e.target.value)}
                            placeholder="например, 'убрать этот дефект'"
                            className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                            disabled={isLoading || !maskDataUrl}
                            autoFocus
                        />
                    </Tooltip>
                    <Tooltip side="left" text="Применить подсказку ретуши к выделенной области">
                        <button
                            type="submit"
                            className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
                            disabled={isLoading || !retouchPrompt.trim() || !maskDataUrl}
                        >
                            {isLoading ? <Spinner size="sm" /> : 'Добавить слой'}
                        </button>
                    </Tooltip>
                </form>
            </div>
        </div>
    );
};

export default RetouchPanel;