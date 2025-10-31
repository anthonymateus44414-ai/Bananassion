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
                        resolve(null); // Resolve with null on error
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
    
    const handleErase = () => {
        if (maskDataUrl) {
            onAddLayer({
                name: `Волшебный ластик`,
                tool: 'magicEraser',
                params: { mask: maskDataUrl, fillPrompt: null }
            });
            setFillPrompt('');
            onClearObjects();
        }
    };
    
    const handleFill = () => {
        if (maskDataUrl && fillPrompt.trim()) {
            onAddLayer({
                name: `Генеративная заливка: ${fillPrompt.slice(0, 15)}...`,
                tool: 'magicEraser',
                params: { mask: maskDataUrl, fillPrompt: fillPrompt.trim() }
            });
            setFillPrompt('');
            onClearObjects();
        }
    };

    const handleRefineClick = () => {
        // Hide the object selection UI, but keep the combined mask
        onConfirmSelection();
        // Enter manual masking mode to refine the selection
        onToggleMasking();
    };
    
    const renderActions = () => (
        <div className="w-full flex flex-col gap-4">
            <Tooltip side="left" text="Удалить выбранную область и плавно заполнить фон">
                <button
                    onClick={handleErase}
                    className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[52px]"
                    disabled={isLoading || !maskDataUrl}
                >
                    {isLoading ? <Spinner size="sm" /> : <><MagicWandIcon className="w-6 h-6" /> Стереть область</>}
                </button>
            </Tooltip>

            <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border-color"></div>
                <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">ИЛИ</span>
                <div className="flex-grow border-t border-border-color"></div>
            </div>

            <div className="flex flex-col gap-2">
                <Tooltip side="left" text="Необязательно: Опишите, что сгенерировать в пустом пространстве (например, 'спокойный океан')">
                    <input
                        type="text"
                        value={fillPrompt}
                        onChange={(e) => setFillPrompt(e.target.value)}
                        placeholder="Заполнить с..."
                        className="flex-grow bg-stone-50 border-2 border-border-color text-text-primary rounded-lg p-3 focus:ring-2 ring-primary focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base font-medium"
                        disabled={isLoading || !maskDataUrl}
                    />
                </Tooltip>
                 <Tooltip side="left" text="Заменить выбранную область сгенерированным контентом">
                    <button
                        onClick={handleFill}
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-12"
                        disabled={isLoading || !maskDataUrl || !fillPrompt.trim()}
                    >
                        <SparklesIcon className="w-5 h-5" /> Заполнить область
                    </button>
                </Tooltip>
            </div>
        </div>
    );

    if (detectedObjects) {
        return (
            <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
                <h3 className="text-xl font-bold text-center text-text-primary">Волшебное выделение</h3>
                <p className="text-sm text-center text-text-secondary -mt-2">
                    Выберите один или несколько объектов для удаления или замены. Вы можете нажать на элементы ниже или на самом изображении.
                </p>

                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 border-y border-border-color py-2">
                    {detectedObjects.map((obj, index) => {
                        const isSelected = selectedObjectMasks.includes(obj.mask);
                        const color = objectSelectionColors[index % objectSelectionColors.length];
                        return (
                            <li key={obj.mask}>
                                <button
                                    onClick={() => onObjectMaskToggle(obj.mask)}
                                    className={`w-full flex items-center gap-3 text-left p-2 rounded-lg transition-colors border-2 ${isSelected ? 'bg-primary/10 border-primary' : 'bg-stone-100 border-transparent hover:bg-stone-200'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        readOnly
                                        className="w-5 h-5 rounded text-primary focus:ring-primary pointer-events-none"
                                    />
                                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></span>
                                    <span className="flex-grow font-semibold text-sm text-text-primary">{obj.name}</span>
                                </button>
                            </li>
                        )
                    })}
                </ul>

                {renderActions()}

                <div className="w-full grid grid-cols-2 justify-center gap-2 mt-2">
                    <Tooltip side="left" text="Отменить выбор объектов и вернуться назад">
                        <button
                            onClick={onClearObjects}
                            disabled={isLoading}
                            className="w-full bg-stone-200 hover:bg-stone-300 font-bold py-3 px-4 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50"
                        >
                            Отмена
                        </button>
                    </Tooltip>
                    <Tooltip side="left" text="Вручную отредактировать выделенную область с помощью кисти">
                        <button
                            onClick={handleRefineClick}
                            disabled={isLoading || selectedObjectMasks.length === 0}
                            className="w-full bg-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out hover:bg-[#4B5563] active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                             <PaintBrushIcon className="w-5 h-5" />
                            Уточнить
                        </button>
                    </Tooltip>
                 </div>
            </div>
        )
    }

    if (maskDataUrl && !detectedObjects) {
        return (
             <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
                <h3 className="text-xl font-bold text-center text-text-primary">Стереть и заполнить</h3>
                 <div className="w-24 h-24 border-2 border-border-color rounded-md p-1 bg-stone-100 self-center">
                    <img src={maskDataUrl} alt="Mask preview" className="w-full h-full object-contain" />
                </div>
                {renderActions()}
                 <Tooltip side="left" text="Перевыбрать область для редактирования">
                    <button onClick={onClearObjects} className="w-full text-center text-sm font-semibold text-text-secondary hover:text-primary">
                        или вернуться назад
                    </button>
                </Tooltip>
            </div>
        );
    }

    return (
        <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold text-center text-text-primary">Волшебный ластик</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">
                Автоматически обнаруживайте объекты или вручную выделите область для удаления.
            </p>
            <div className="flex flex-col items-center gap-4">
                 <Tooltip side="left" text="Автоматически найти объекты на изображении для легкого выбора">
                    <button
                        onClick={onFindObjects}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-5 rounded-lg transition-colors text-base h-12"
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner size="sm" /> : <><MagicWandIcon className="w-5 h-5"/> Найти объекты</>}
                    </button>
                </Tooltip>
                <div className="relative flex py-1 items-center w-full">
                    <div className="flex-grow border-t border-border-color"></div>
                    <span className="flex-shrink mx-4 text-text-secondary text-xs font-bold">ИЛИ</span>
                    <div className="flex-grow border-t border-border-color"></div>
                </div>
                 <Tooltip side="left" text="Вручную выбрать область для стирания с помощью кисти">
                    <button
                        onClick={onToggleMasking}
                        className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-[#4B5563] text-white font-bold py-3 px-5 rounded-lg transition-colors text-base h-12"
                        disabled={isLoading}
                    >
                        <PaintBrushIcon className="w-5 h-5"/>
                        Ручная кисть
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default MagicEraserPanel;