/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { Layer, Tool } from '../types.ts';
import { 
    EyeIcon, EyeSlashIcon, TrashIcon, ArrowDownTrayIcon, ArrowPathIcon, 
    UndoIcon, RedoIcon, ArrowCounterclockwiseIcon, XCircleIcon,
    SunIcon, SparklesIcon, BullseyeIcon, PencilSquareIcon, UserCircleIcon,
    PhotoIcon, TshirtIcon, UserPlusIcon, CubeTransparentIcon, ArrowsPointingOutIcon,
    CameraIcon, PaintBrushIcon, PaletteIcon, SwatchIcon, FaceSmileIcon, MagicWandIcon,
    LayersIcon, TransformIcon
} from './icons.tsx';
import Tooltip from './Tooltip.tsx';
import Spinner from './Spinner.tsx';

interface LayersPanelProps {
  layers: Layer[];
  baseImageUrl: string;
  loadingMessage: string;
  onReorderLayers: (layers: Layer[]) => void;
  onToggleVisibility: (id: string) => void;
  onRemoveLayer: (id: string) => void;
  onNewImage: () => void;
  onDownload: () => void;
  onRevertAll: () => void;
  onClearCache: () => void;
  onUndo: () => void;
  onRedo: () => void;
  hasUndo: boolean;
  hasRedo: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
}

const getToolIcon = (tool: Tool) => {
    switch (tool) {
        case 'adjust': return <SunIcon className="w-5 h-5" />;
        case 'enhance': return <SparklesIcon className="w-5 h-5" />;
        case 'retouch': return <BullseyeIcon className="w-5 h-5" />;
        case 'textEdit': return <PencilSquareIcon className="w-5 h-5" />;
        case 'faceSwap': return <UserCircleIcon className="w-5 h-5" />;
        case 'background': return <PhotoIcon className="w-5 h-5" />;
        case 'clothing': return <TshirtIcon className="w-5 h-5" />;
        case 'addPerson': return <UserPlusIcon className="w-5 h-5" />;
        case 'addObject': return <CubeTransparentIcon className="w-5 h-5" />;
        case 'expand': return <ArrowsPointingOutIcon className="w-5 h-5" />;
        case 'camera': return <CameraIcon className="w-5 h-5" />;
        case 'style': return <PaintBrushIcon className="w-5 h-5" />;
        case 'filter': return <PaletteIcon className="w-5 h-5" />;
        case 'color': return <SwatchIcon className="w-5 h-5" />;
        case 'facial': return <FaceSmileIcon className="w-5 h-5" />;
        case 'mix': return <LayersIcon className="w-5 h-5" />;
        case 'magicEraser': return <MagicWandIcon className="w-5 h-5" />;
        case 'image': return <PhotoIcon className="w-5 h-5" />;
        case 'transform': return <TransformIcon className="w-5 h-5" />;
        default: return <div className="w-5 h-5" />; // Placeholder
    }
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  baseImageUrl,
  loadingMessage,
  onReorderLayers,
  onToggleVisibility,
  onRemoveLayer,
  onNewImage,
  onDownload,
  onRevertAll,
  onClearCache,
  onUndo,
  onRedo,
  hasUndo,
  hasRedo,
  selectedLayerId,
  onSelectLayer,
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const canClearCache = layers.some(l => l.isVisible && l.cachedResult);
  
  const loadingLayerId = loadingMessage.startsWith('Применение: ')
    ? layers.find(l => l.name === loadingMessage.substring('Применение: '.length))?.id
    : null;

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    dragItem.current = index;
    // Visually indicate dragging immediately
    e.currentTarget.style.opacity = '0.5';
  };
  
  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLayers = [...layers];
      const draggedItemContent = newLayers.splice(dragItem.current, 1)[0];
      newLayers.splice(dragOverItem.current, 0, draggedItemContent);
      onReorderLayers(newLayers);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIndex(null);
    e.currentTarget.style.opacity = '1';
  };

  const handleDragLeave = () => {
    // A small delay helps prevent flickering when moving over child elements.
    setTimeout(() => {
        if (dragOverItem.current === null) {
            setDragOverIndex(null);
        }
    }, 50);
  }
  
  const reversedLayers = [...layers].reverse();

  return (
    <div className="h-full w-full p-2 flex flex-col gap-2">
        <h3 className="text-xl font-bold text-center text-text-primary py-2">Слои и действия</h3>
        
        <div className="flex-grow flex flex-col gap-2 overflow-y-auto pr-1">
            {layers.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-sm text-text-secondary text-center px-4 font-semibold">Ваши правки будут отображаться здесь в виде слоев.</p>
                </div>
            ) : (
                <ul 
                    className="flex flex-col gap-1"
                    onDragLeave={handleDragLeave}
                >
                    {reversedLayers.map((layer, index) => {
                        const originalIndex = layers.length - 1 - index;
                        const isProcessing = loadingLayerId === layer.id;
                        const isSelected = selectedLayerId === layer.id;
                        
                        return (
                           <React.Fragment key={layer.id}>
                                {dragOverIndex === originalIndex && <li className="h-1 bg-primary rounded-full animate-fade-in" aria-hidden="true"></li>}
                                <li
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, originalIndex)}
                                    onDragEnter={() => handleDragEnter(originalIndex)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onSelectLayer(layer.id)}
                                    className={`flex items-center gap-3 p-2 cursor-pointer transition-all duration-200 rounded-lg border-2 ${isProcessing ? 'bg-blue-100 border-primary animate-pulse' : isSelected ? 'bg-blue-50 border-primary' : 'bg-gray-50 border-transparent'} ${!layer.isVisible ? 'opacity-60' : ''}`}
                                >
                                    <div className="w-10 h-10 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden border border-border-color">
                                        {layer.cachedResult ? (
                                            <img src={layer.cachedResult} alt={`Предпросмотр ${layer.name}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Spinner size="sm" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow flex items-center gap-2 overflow-hidden">
                                        <div className="text-text-secondary">{getToolIcon(layer.tool)}</div>
                                        <span className="text-sm font-bold text-text-primary truncate">{layer.name}</span>
                                    </div>
                                    <Tooltip side="left" text={layer.isVisible ? "Скрыть слой" : "Показать слой"}>
                                        <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-gray-200">
                                            {layer.isVisible ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                                        </button>
                                    </Tooltip>
                                    <Tooltip side="left" text="Удалить слой">
                                        <button onClick={(e) => { e.stopPropagation(); onRemoveLayer(layer.id); }} className="p-1 text-text-secondary hover:text-red-500 rounded-full hover:bg-red-100">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </Tooltip>
                                </li>
                           </React.Fragment>
                        );
                    })}
                </ul>
            )}
            <div className={`flex items-center gap-3 p-2 mt-auto border-2 border-dashed border-border-color/80 rounded-lg text-text-secondary`}>
                 <div className="w-10 h-10 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden border border-border-color">
                    {baseImageUrl && <img src={baseImageUrl} alt="Базовое изображение" className="w-full h-full object-cover" />}
                </div>
                 <span className="text-sm font-bold">Базовое изображение</span>
            </div>
        </div>
        
        <div className="flex-shrink-0 pt-2 border-t border-border-color">
            <div className="grid grid-cols-2 gap-2">
                <Tooltip text="Отменить (Ctrl+Z)">
                    <button onClick={onUndo} disabled={!hasUndo} className="flex items-center justify-center gap-2 p-3 w-full h-12 transition-colors duration-200 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <UndoIcon className="w-6 h-6" /> <span className="font-semibold">Отменить</span>
                    </button>
                </Tooltip>
                <Tooltip text="Повторить (Ctrl+Y)">
                    <button onClick={onRedo} disabled={!hasRedo} className="flex items-center justify-center gap-2 p-3 w-full h-12 transition-colors duration-200 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <RedoIcon className="w-6 h-6" /> <span className="font-semibold">Повторить</span>
                    </button>
                </Tooltip>
            </div>
            <div className="mt-2 p-2 bg-red-50/50 rounded-lg border border-red-200/80">
                <div className="grid grid-cols-2 gap-2">
                    <Tooltip text="Отменить все изменения">
                        <button onClick={onRevertAll} disabled={layers.length === 0} className="flex items-center justify-center gap-2 p-3 w-full transition-colors duration-200 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            <ArrowPathIcon className="w-5 h-5" /> <span className="font-semibold text-sm">Сбросить</span>
                        </button>
                    </Tooltip>
                    <Tooltip text="Начать сначала с новым изображением">
                        <button onClick={onNewImage} className="flex items-center justify-center gap-2 p-3 w-full transition-colors duration-200 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                             <XCircleIcon className="w-5 h-5" /> <span className="font-semibold text-sm">Новый</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
             <Tooltip side="left" text="Очистить кэш и заново обработать все видимые слои. Полезно при переключении с 'Быстрого режима'.">
                <button onClick={onClearCache} disabled={!canClearCache} className="w-full mt-2 p-2 flex items-center justify-center gap-2 transition-colors duration-200 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ArrowCounterclockwiseIcon className="w-5 h-5" /> <span className="font-semibold text-sm">Перерисовать слои</span>
                </button>
             </Tooltip>
            
            <Tooltip side="left" text="Сохранить финальное изображение на ваше устройство">
                <button onClick={onDownload} className="w-full mt-2 p-3 bg-primary text-white hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 font-bold text-lg rounded-lg active:scale-[0.98]">
                    <ArrowDownTrayIcon className="w-6 h-6" />
                    Скачать
                </button>
            </Tooltip>
        </div>
    </div>
  );
};

export default React.memo(LayersPanel);