/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Tooltip from './Tooltip';
import { BrushShape } from '../types';
import { CircleIcon, SquareIcon } from './icons';

interface MaskingPanelProps {
  onBrushSizeChange: (size: number) => void;
  brushSize: number;
  onBrushShapeChange: (shape: BrushShape) => void;
  brushShape: BrushShape;
  onBrushHardnessChange: (hardness: number) => void;
  brushHardness: number;
  onOpacityChange: (opacity: number) => void;
  previewOpacity: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const MaskingPanel: React.FC<MaskingPanelProps> = ({
  onBrushSizeChange,
  brushSize,
  onBrushShapeChange,
  brushShape,
  onBrushHardnessChange,
  brushHardness,
  onOpacityChange,
  previewOpacity,
  onConfirm,
  onCancel,
  isLoading,
}) => {

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBrushSizeChange(parseInt(e.target.value, 10));
  };
  
  const handleHardnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBrushHardnessChange(parseFloat(e.target.value));
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onOpacityChange(parseFloat(e.target.value));
  };

  // Map brush size (5-100) to a preview size (e.g., 4-40px)
  const previewSize = (brushSize / 100) * 40;

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col items-center gap-4 animate-fade-in text-text-primary">
        <h3 className="text-xl font-bold text-center">Режим маски</h3>
        <p className="text-sm text-center text-text-secondary -mt-2">
            Закрасьте область, которую хотите отредактировать. Используйте прокрутку для масштабирования.
        </p>
        
        {/* Brush Size Slider with Visual Preview */}
        <div className="w-full flex flex-col items-center gap-2">
            <div className="w-full flex justify-between items-center mb-1">
                <label htmlFor="brush-size" className="text-sm font-semibold">
                    Размер кисти: {brushSize}
                </label>
                <div className="w-12 h-12 flex items-center justify-center bg-stone-100 rounded-md border border-border-color">
                    <div
                        className={`${brushShape === 'circle' ? 'rounded-full' : 'rounded-sm'}`}
                        style={{
                            width: `${previewSize}px`,
                            height: `${previewSize}px`,
                            background: brushShape === 'circle'
                                ? `radial-gradient(circle, rgba(107, 114, 128, 1) ${brushHardness * 100}%, rgba(107, 114, 128, 0) 100%)`
                                : 'rgb(107, 114, 128)',
                            transition: 'width 0.1s ease, height 0.1s ease'
                        }}
                        aria-hidden="true"
                    ></div>
                </div>
            </div>
            <Tooltip side="left" text="Настройте размер кисти для рисования или стирания маски.">
                <input
                    id="brush-size"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={handleSizeChange}
                    disabled={isLoading}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                />
            </Tooltip>
        </div>

        {/* Brush Hardness Slider */}
        <div className="w-full flex flex-col items-center gap-2">
            <label htmlFor="brush-hardness" className="text-sm font-semibold w-full text-left">
                Жесткость кисти: {Math.round(brushHardness * 100)}%
            </label>
            <Tooltip side="left" text="Настройте мягкость краев кисти. Доступно только для круглой кисти.">
                <input
                    id="brush-hardness"
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={brushHardness}
                    onChange={handleHardnessChange}
                    disabled={isLoading || brushShape === 'square'}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
            </Tooltip>
        </div>

        {/* Opacity Slider */}
        <div className="w-full flex flex-col items-center gap-2">
            <label htmlFor="preview-opacity" className="text-sm font-semibold w-full text-left">
            Прозрачность предпросмотра: {Math.round(previewOpacity * 100)}%
            </label>
            <Tooltip side="left" text="Настройте прозрачность предпросмотра маски на холсте.">
                <input
                    id="preview-opacity"
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={previewOpacity}
                    onChange={handleOpacityChange}
                    disabled={isLoading}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                />
            </Tooltip>
        </div>

        {/* Brush Shape Selection */}
        <div className="w-full flex flex-col items-center gap-3">
            <span className="text-sm font-semibold">Форма кисти</span>
            <div className="flex items-center gap-4">
                <Tooltip side="left" text="Круглая кисть (Рисовать)">
                    <button
                        onClick={() => onBrushShapeChange('circle')}
                        className={`p-3 rounded-lg transition-all duration-200 border-2 ${
                            brushShape === 'circle'
                                ? 'bg-primary text-white border-primary ring-2 ring-offset-2 ring-primary'
                                : 'bg-stone-50 text-text-secondary border-border-color hover:bg-stone-100'
                        }`}
                    >
                        <CircleIcon className="w-6 h-6" />
                    </button>
                </Tooltip>
                <Tooltip side="left" text="Квадратная кисть (Стирать)">
                    <button
                        onClick={() => onBrushShapeChange('square')}
                        className={`p-3 rounded-lg transition-all duration-200 border-2 ${
                            brushShape === 'square'
                                ? 'bg-primary text-white border-primary ring-2 ring-offset-2 ring-primary'
                                : 'bg-stone-50 text-text-secondary border-border-color hover:bg-stone-100'
                        }`}
                    >
                        <SquareIcon className="w-6 h-6" />
                    </button>
                </Tooltip>
            </div>
        </div>

        <div className="w-full flex justify-center gap-4 mt-2">
            <Tooltip side="left" text="Отменить маскирование и вернуться к параметрам инструмента">
            <button
                onClick={onCancel}
                disabled={isLoading}
                className="w-full bg-stone-200 hover:bg-stone-300 font-bold py-3 px-6 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50"
            >
                Отмена
            </button>
            </Tooltip>
            <Tooltip side="left" text="Подтвердить выбранную маску и продолжить редактирование">
            <button
                onClick={onConfirm}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50"
            >
                Подтвердить
            </button>
            </Tooltip>
        </div>
    </div>
  );
};

export default MaskingPanel;