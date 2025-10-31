/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { Layer } from '../types.ts';
import { EyeIcon, EyeSlashIcon, TrashIcon, ArrowDownTrayIcon, ArrowPathIcon, UndoIcon, RedoIcon, ArrowCounterclockwiseIcon, XCircleIcon } from './icons.tsx';
import Tooltip from './Tooltip.tsx';
import Spinner from './Spinner.tsx';

interface LayersPanelProps {
  layers: Layer[];
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
}

const Divider: React.FC = () => <hr className="border-border-color my-2" />;

const ActionButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }> = ({ label, icon, onClick, disabled }) => (
      <Tooltip side="left" text={label}>
          <button
              onClick={onClick}
              disabled={disabled}
              aria-label={label}
              className={`flex items-center justify-center p-3 w-full h-12 transition-colors duration-200 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
              {icon}
          </button>
      </Tooltip>
);

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
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
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const canClearCache = layers.some(l => l.isVisible && l.cachedResult);
  
  const loadingLayerName = loadingMessage.startsWith('Применение: ')
    ? loadingMessage.substring('Применение: '.length)
    : null;

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    dragItem.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLayers = [...layers];
      const draggedItemContent = newLayers.splice(dragItem.current, 1)[0];
      newLayers.splice(dragOverItem.current, 0, draggedItemContent);
      onReorderLayers(newLayers);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggedIndex(null);
  };
  
  const reversedLayers = [...layers].reverse();

  return (
    <div className="h-full w-full p-2 flex flex-col gap-2">
        <h3 className="text-xl font-bold text-center text-text-primary py-2">Слои</h3>
        
        <div className="flex-grow flex flex-col gap-2 overflow-y-auto pr-1">
            {layers.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-sm text-text-secondary text-center px-4 font-semibold">Ваши правки будут отображаться здесь в виде слоев.</p>
                </div>
            ) : (
                <ul onDragEnd={handleDragEnd} className="flex flex-col gap-2">
                    {reversedLayers.map((layer, index) => {
                        const originalIndex = layers.length - 1 - index;
                        const isProcessing = loadingLayerName === layer.name;
                        const isBeingDragged = draggedIndex === originalIndex;
                        return (
                            <li
                                key={layer.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, originalIndex)}
                                onDragEnter={(e) => handleDragEnter(e, originalIndex)}
                                onDragOver={(e) => e.preventDefault()}
                                className={`flex items-center gap-2 p-2 cursor-grab transition-all duration-200 rounded-lg border-2 ${isProcessing ? 'bg-blue-100 border-primary animate-pulse' : 'bg-gray-50 border-transparent'} ${!layer.isVisible ? 'opacity-60' : ''} ${isBeingDragged ? 'opacity-50 bg-blue-100 border-primary' : ''}`}
                            >
                                {isProcessing && <Spinner size="sm" className="ml-1"/>}
                                <div className="flex-grow text-sm font-bold text-text-primary truncate">{layer.name}</div>
                                <Tooltip side="left" text={layer.isVisible ? "Скрыть слой" : "Показать слой"}>
                                    <button onClick={() => onToggleVisibility(layer.id)} className="text-text-secondary hover:text-text-primary">
                                        {layer.isVisible ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                                    </button>
                                </Tooltip>
                                <Tooltip side="left" text="Удалить слой">
                                    <button onClick={() => onRemoveLayer(layer.id)} className="text-text-secondary hover:text-red-500">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </Tooltip>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className={`p-2 mt-auto border-2 border-dashed border-border-color/80 rounded-lg text-center text-sm font-bold transition-colors text-text-secondary`}>
                Базовое изображение
            </div>
        </div>
        
        <Divider />
        
        <div className="grid grid-cols-2 gap-2">
            <ActionButton label="Отменить (Ctrl+Z)" icon={<UndoIcon className="w-6 h-6" />} onClick={onUndo} disabled={!hasUndo} />
            <ActionButton label="Повторить (Ctrl+Y)" icon={<RedoIcon className="w-6 h-6" />} onClick={onRedo} disabled={!hasRedo} />
            <ActionButton label="Отменить все" icon={<ArrowPathIcon className="w-6 h-6" />} onClick={onRevertAll} disabled={layers.length === 0} />
            <ActionButton label="Начать сначала" icon={<XCircleIcon className="w-6 h-6" />} onClick={onNewImage} />
        </div>
        <div className="mt-2">
          <ActionButton label="Очистить кэш и перерисовать" icon={<ArrowCounterclockwiseIcon className="w-6 h-6" />} onClick={onClearCache} disabled={!canClearCache} />
        </div>
        
        <Tooltip side="left" text="Сохранить финальное изображение на ваше устройство">
            <button onClick={onDownload} className="w-full mt-2 p-3 bg-primary text-white hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 font-bold text-lg rounded-lg active:scale-[0.98]">
                <ArrowDownTrayIcon className="w-6 h-6" />
                Скачать
            </button>
        </Tooltip>
    </div>
  );
};

export default React.memo(LayersPanel);