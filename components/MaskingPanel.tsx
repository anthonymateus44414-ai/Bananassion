/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon, TrashIcon } from './icons';

interface MaskingPanelProps {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onClearMask: () => void;
  onCancel: () => void;
  onDone: () => void;
  isErasing: boolean;
  onToggleErase: () => void;
}

const MaskingPanel: React.FC<MaskingPanelProps> = ({
  brushSize,
  onBrushSizeChange,
  onClearMask,
  onCancel,
  onDone,
  isErasing,
  onToggleErase,
}) => {
  return (
    <div className="w-full max-w-lg bg-gray-800/80 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm shadow-2xl">
      <h3 className="text-lg font-semibold text-gray-200">Draw Mask</h3>
      <p className="text-sm text-gray-400 -mt-2">Paint over the area you want to edit.</p>
      
      <div className="w-full flex items-center gap-4">
          <Tooltip text={isErasing ? 'Switch to Brush to add to the mask' : 'Switch to Eraser to remove from the mask'}>
              <button
                  onClick={onToggleErase}
                  className={`p-3 rounded-lg transition-colors ${isErasing ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                  <PaintBrushIcon className="w-6 h-6" />
                  {isErasing && <div className="absolute w-full h-0.5 bg-white rotate-45 top-1/2 left-0 transform -translate-y-1/2"></div>}
              </button>
          </Tooltip>
        
        <div className="flex-grow flex items-center gap-3">
            <label htmlFor="brushSize" className="text-sm font-medium text-gray-300">Brush Size</label>
            <input
                id="brushSize"
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => onBrushSizeChange(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <Tooltip text="Erase everything you have painted on the mask">
            <button
                onClick={onClearMask}
                className="p-3 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
                <TrashIcon className="w-6 h-6" />
            </button>
        </Tooltip>
      </div>

      <div className="w-full flex items-center justify-center gap-3 mt-2">
        <Tooltip text="Discard the mask and return to the tool options">
            <button
              onClick={onCancel}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors active:scale-95"
            >
              Cancel
            </button>
        </Tooltip>
        <Tooltip text="Confirm the masked area and return to the tool options">
            <button
              onClick={onDone}
              className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl active:scale-95"
            >
              Done
            </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default MaskingPanel;