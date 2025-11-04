/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon, MagicWandIcon, SparklesIcon } from './icons';
import { Layer, DetectedObject } from '../types';
import Spinner from './Spinner';

interface MagicEraserPanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
  onFindObjects: () => void;
  detectedObjects: DetectedObject[] | null;
  selectedObjectMasks: string[];
  onSetMaskDataUrl: (dataUrl: string | null) => void;
  onClearObjects: () => void;
  onConfirmSelection: () => void;
  onObjectMaskToggle: (maskUrl: string) => void;
}

type MagicTab = 'remove' | 'generate';

const MagicEraserPanel: React.FC<MagicEraserPanelProps> = ({ 
  onAddLayer, 
  isLoading,
  maskDataUrl,
  onToggleMasking,
  onFindObjects,
  detectedObjects,
  selectedObjectMasks,
  onSetMaskDataUrl,
  onClearObjects,
  onConfirmSelection,
  onObjectMaskToggle,
}) => {
    const [activeTab, setActiveTab] = useState<MagicTab>('remove');
    const [fillPrompt, setFillPrompt] = useState('');

    const objectSelectionColors = useMemo(() => [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'
    ], []);

    useEffect(() => {
        const combineMasks = async () => {
            if (selectedObjectMasks.length === 0) {
                onSetMaskDataUrl(null);
                return;
            }

            const imagePromises = selectedObjectMasks.map(src => {
                return new Promise<HTMLImageElement | null>(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.warn('Failed to load a mask image data URL.');
                        resolve(null);
                    };
                    img.src = src;
                });
            });
            
            const allResults = await Promise.all(imagePromises);
            const validImages = allResults.filter((img): img is HTMLImageElement => img !== null && img.width > 0 && img.height > 0);

            if (validImages.length === 0) {
                onSetMaskDataUrl(null);
                return;
            }

            const canvas = document.createElement('canvas');
            const firstImage = validImages[0];
            canvas.width = firstImage.width;
            canvas.height = firstImage.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.error("Could not get canvas context for combining masks.");
                onSetMaskDataUrl(null);
                return;
            }

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'lighter';
            
            validImages.forEach(img => {
                ctx.drawImage(img, 0, 0);
            });

            onSetMaskDataUrl(canvas.toDataURL());
        };

        if (detectedObjects) {
             combineMasks();
        }
    }, [selectedObjectMasks, detectedObjects, onSetMaskDataUrl]);
    
    const handleAction = (isGenerativeFill: boolean) => {
        if (!maskDataUrl) return;

        const name = isGenerativeFill ? `Генеративная заливка: ${fillPrompt.slice(0, 15)}...` : `Волшебный ластик`;
        const params = { mask: maskDataUrl, fillPrompt: isGenerativeFill ? fillPrompt.trim() : null };
        
        onAddLayer({ name, tool: 'magicEraser', params });

        setFillPrompt('');
        onClearObjects();
    };
    
    const handleTabChange = (tab: MagicTab) => {
        onClearObjects(); // Reset state when switching tabs
        setActiveTab(tab);
    }
    
    const renderRemoveTab = () => {
        if (detectedObjects) {
            return (
                <div className="w-full flex flex-col gap-4 animate-fade-in">
                    <p className="text-sm text-center text-text-secondary">
                        Выберите один или несколько объектов для удаления.
                    </p>

                    <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 border-y border-border-color py-2">
                        {detectedObjects.map((obj, index) => {
                            const isSelected = selectedObjectMasks.includes(obj.mask);
                            const color = objectSelectionColors[index % objectSelectionColors.length];
                            return (
                                <li key={obj.mask}>
                                    <Tooltip text={`Выбрать/отменить выбор "${obj.name}"`}>
                                        <button
                                            onClick={() => onObjectMaskToggle(obj.mask)}
                                            className={`w-full flex items-center gap-3 text-left p-2 rounded-lg transition-colors border-2 ${isSelected ? 'bg-primary/10 border-primary' : 'bg-stone-100 border-transparent hover:bg-stone-200'}`}
                                        >
                                            <div className="w-5 h-5 flex items-center justify-center rounded border-2 border-gray-300 bg-white">{isSelected && <div className="w-3 h-3 rounded-sm bg-primary"></div>}</div>
                                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></span>
                                            <span className="flex-grow font-semibold text-sm text-text-primary">{obj.name}</span>
                                        </button>
                                    </Tooltip>
                                </li>
                            )
                        })}
                    </ul>

                    <Tooltip side="left" text="Удалить выбранные объекты и плавно заполнить фон">
                        <button
                            onClick={() => handleAction(false)}
                            className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                            disabled={isLoading || !maskDataUrl}
                        >
                            {isLoading ? <Spinner size="sm" /> : <><MagicWandIcon className="w-6 h-6" /> Удалить выбранное</>}
                        </button>
                    </Tooltip>
                    
                    <div className="w-full grid grid-cols-2 justify-center gap-2">
                        <Tooltip side="left" text="Отменить выбор объектов и вернуться назад">
                            <button onClick={onClearObjects} disabled={isLoading} className="w-full bg-stone-200 hover:bg-stone-300 font-bold py-3 px-4 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50">Отмена</button>
                        </Tooltip>
                        <Tooltip side="left" text="Вручную отредактировать выделенную область с помощью кисти">
                            <button onClick={onConfirmSelection} disabled={isLoading || !maskDataUrl} className="w-full bg-secondary text-white font-bold py-3 px-4 rounded-lg transition-all hover:bg-[#4B5563] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"><PaintBrushIcon className="w-5 h-5" />Уточнить</button>
                        </Tooltip>
                    </div>
                </div>
            );
        }

        if (maskDataUrl) {
            return (
                <div className="w-full flex flex-col gap-4 animate-fade-in items-center">
                    <p className="text-sm text-text-secondary text-center">Область выбрана кистью. Нажмите "Удалить", чтобы продолжить.</p>
                     <div className="w-24 h-24 border-2 border-border-color rounded-md p-1 bg-stone-100">
                        <img src={maskDataUrl} alt="Mask preview" className="w-full h-full object-contain" />
                    </div>
                     <Tooltip side="left" text="Удалить выбранную область и плавно заполнить фон">
                        <button onClick={() => handleAction(false)} className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]" disabled={isLoading}>
                             {isLoading ? <Spinner size="sm" /> : <><MagicWandIcon className="w-6 h-6" /> Удалить область</>}
                        </button>
                    </Tooltip>
                    <button onClick={onClearObjects} className="text-sm font-semibold text-text-secondary hover:text-primary">Отменить</button>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center gap-4 animate-fade-in">
                <Tooltip side="left" text="Автоматически найти объекты на изображении для легкого выбора">
                   <button onClick={onFindObjects} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-5 rounded-lg transition-colors text-base h-12" disabled={isLoading}>
                       {isLoading ? <Spinner size="sm" /> : <><MagicWandIcon className="w-5 h-5"/> Найти объекты</>}
                   </button>
               </Tooltip>
               <div className="relative flex py-1 items-center w-full">
                   <div className="flex-grow border-t border-border-color"></div>
                   <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">ИЛИ</span>
                   <div className="flex-grow border-t border-border-color"></div>
               </div>
                <Tooltip side="left" text="Вручную выбрать область для стирания с помощью кисти">
                   <button onClick={onToggleMasking} className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-[#4B5563] text-white font-bold py-3 px-5 rounded-lg transition-colors text-base h-12" disabled={isLoading}>
                       <PaintBrushIcon className="w-5 h-5"/> Ручная кисть
                   </button>
               </Tooltip>
           </div>
        );
    };

    const renderGenerateTab = () => {
        if (!maskDataUrl) {
            return (
                <div className="flex flex-col items-center gap-4 animate-fade-in text-center">
                    <p className="text-sm text-text-secondary">Замените любую часть вашего изображения чем-то новым. Сначала выберите область для генерации.</p>
                    <Tooltip side="left" text="Выбрать область для генерации нового контента с помощью кисти">
                        <button onClick={onToggleMasking} className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-[#4B5563] text-white font-bold py-3 px-5 rounded-lg transition-colors text-base h-12" disabled={isLoading}>
                            <PaintBrushIcon className="w-5 h-5"/> Выбрать область
                        </button>
                    </Tooltip>
                </div>
            );
        }

        return (
            <div className="w-full flex flex-col gap-4 animate-fade-in items-center">
                <p className="text-sm text-text-secondary text-center">Область выбрана. Теперь опишите, что вы хотите сгенерировать.</p>
                <div className="w-24 h-24 border-2 border-border-color rounded-md p-1 bg-stone-100">
                    <img src={maskDataUrl} alt="Mask preview" className="w-full h-full object-contain" />
                </div>
                 <Tooltip side="left" text="Опишите, что сгенерировать в выбранном пространстве (например, 'спокойный океан')">
                    <input
                        type="text"
                        value={fillPrompt}
                        onChange={(e) => setFillPrompt(e.target.value)}
                        placeholder="Опишите, что сгенерировать..."
                        className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                        disabled={isLoading}
                        autoFocus
                    />
                </Tooltip>
                <Tooltip side="left" text="Заменить выбранную область сгенерированным контентом">
                   <button
                       onClick={() => handleAction(true)}
                       className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-12"
                       disabled={isLoading || !fillPrompt.trim()}
                   >
                        {isLoading ? <Spinner size="sm" /> : <><SparklesIcon className="w-5 h-5" /> Сгенерировать</>}
                   </button>
               </Tooltip>
                <button onClick={onClearObjects} className="text-sm font-semibold text-text-secondary hover:text-primary">Отменить</button>
            </div>
        );
    };

    const tabs: { id: MagicTab, name: string }[] = [
        { id: 'remove', name: 'Удалить' },
        { id: 'generate', name: 'Сгенерировать' },
    ];

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Волшебная студия</h3>
            <div className="w-full bg-stone-100 border border-border-color rounded-lg p-1 flex items-center justify-center gap-1">
                {tabs.map(tab => (
                    <Tooltip side="left" key={tab.id} text={tab.id === 'remove' ? 'Удалить объект или область' : 'Заменить область сгенерированным контентом'}>
                        <button
                            onClick={() => handleTabChange(tab.id)}
                            className={`w-full capitalize font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            {tab.name}
                        </button>
                    </Tooltip>
                ))}
            </div>
            
            <div className="mt-2">
                {activeTab === 'remove' ? renderRemoveTab() : renderGenerateTab()}
            </div>
        </div>
    );
};

export default MagicEraserPanel;
