/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon } from './icons';
import { Layer } from '../types';
import Spinner from './Spinner';

interface FacialPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
}

const FacialPanel: React.FC<FacialPanelProps> = ({ 
  onAddLayer, 
  isLoading,
  maskDataUrl,
  onToggleMasking
}) => {
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    const presets = [
        { name: 'Гладкая кожа', prompt: 'Деликатно сгладить текстуру кожи, уменьшая пятна и мелкие морщины для естественного, здорового вида. Не делать эффект "пластика" или "аэрографа".' },
        { name: 'Осветлить глаза', prompt: 'Слегка осветлить глаза и сделать их более яркими. Добавить небольшой блеск в зрачки, чтобы они выделялись.' },
        { name: 'Улучшить губы', prompt: 'Немного увеличить насыщенность и четкость губ для более полного и здорового вида. Не менять цвет губ.' },
        { name: 'Уточнить овал лица', prompt: 'Деликатно подчеркнуть и определить линию подбородка и овала лица для более четкого и скульптурного вида.' },
    ];

    const activePrompt = selectedPreset || customPrompt;

    const handlePresetClick = (prompt: string) => {
        setCustomPrompt('');
        setSelectedPreset(prompt);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedPreset(null);
        setCustomPrompt(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (maskDataUrl && activePrompt.trim()) {
            const presetName = presets.find(p => p.prompt === activePrompt)?.name;
            const name = presetName || `Custom: ${activePrompt.slice(0, 15)}...`;
            onAddLayer({
              name: `Лицо: ${name}`,
              tool: 'facial',
              params: { prompt: activePrompt, mask: maskDataUrl }
            });
            setCustomPrompt('');
            setSelectedPreset(null);
        }
    };

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Улучшение лица</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">
                {maskDataUrl ? "Область выбрана. Теперь выберите пресет или опишите улучшение." : "Выберите область на изображении (например, кожу, глаза) для улучшения."}
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
            </div>

            <div className="grid grid-cols-2 gap-2">
                {presets.map(preset => (
                    <Tooltip side="left" key={preset.name} text={preset.prompt}>
                        <button
                            onClick={() => handlePresetClick(preset.prompt)}
                            disabled={isLoading || !maskDataUrl}
                            className={`w-full text-center font-bold py-3 px-2 border rounded-lg transition-all duration-200 ease-in-out active:scale-[0.98] text-sm disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset === preset.prompt ? 'bg-primary text-white border-transparent' : 'bg-stone-50 text-text-primary border-border-color hover:bg-stone-100 hover:border-stone-400'}`}
                        >
                        {preset.name}
                        </button>
                    </Tooltip>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2">
                <Tooltip side="left" text="Опишите пользовательское улучшение, например, 'слегка отбелить зубы'">
                    <input
                        type="text"
                        value={customPrompt}
                        onChange={handleCustomChange}
                        placeholder="Или опишите улучшение..."
                        className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                        disabled={isLoading || !maskDataUrl}
                    />
                </Tooltip>
                <Tooltip side="left" text="Применить улучшение к выбранной области">
                    <button
                        type="submit"
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-[52px]"
                        disabled={isLoading || !activePrompt.trim() || !maskDataUrl}
                    >
                        {isLoading ? <Spinner size="sm" /> : 'Добавить слой'}
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default FacialPanel;