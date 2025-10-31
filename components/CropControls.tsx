/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Tooltip from './Tooltip';

interface CropControlsProps {
  onApply: () => void;
  onCancel: () => void;
  canApply: boolean;
}

const CropControls: React.FC<CropControlsProps> = ({ onApply, onCancel, canApply }) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xs">
        <div className="bg-bg-panel/90 backdrop-blur-sm border border-border-color rounded-xl shadow-lg p-4 flex justify-center items-center gap-4 animate-fade-in text-text-primary">
            <Tooltip text="Отменить кадрирование и вернуться к предыдущему состоянию">
                <button
                    onClick={onCancel}
                    className="w-full bg-gray-200 hover:bg-gray-300 font-bold py-3 px-6 rounded-lg transition-colors active:scale-[0.98]"
                >
                    Отмена
                </button>
            </Tooltip>
            <Tooltip text="Применить текущую обрезку">
                <button
                    onClick={onApply}
                    disabled={!canApply}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Применить
                </button>
            </Tooltip>
        </div>
    </div>
  );
};

export default CropControls;