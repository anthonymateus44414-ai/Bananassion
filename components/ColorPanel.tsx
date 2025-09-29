/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Tool } from '../types';
import { PaintBrushIcon } from './icons';

interface ColorPanelProps {
  onApplyColorAdjustment: (prompt: string, mask: string | null) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
  adjustments: { hue: number; saturation: number; brightness: number; };
  onAdjustmentsChange: (adjustments: { hue: number; saturation: number; brightness: number; }) => void;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { prompt: string, hue: number, saturation: number, brightness: number } }) => void;
}

const ColorPanel: React.FC<ColorPanelProps> = ({ 
  onApplyColorAdjustment, 
  isLoading, 
  maskDataUrl,
  onToggleMasking,
  adjustments,
  onAdjustmentsChange,
  mode = 'interactive', 
  onAddToRecipe 
}) => {
  const [isAreaMode, setIsAreaMode] = useState(false);
  const { hue, saturation, brightness } = adjustments;

  const handleApply = () => {
    const adjustmentsText = [];
    if (hue !== 0) adjustmentsText.push(`Hue: ${hue > 0 ? '+' : ''}${hue}`);
    if (saturation !== 0) adjustmentsText.push(`Saturation: ${saturation > 0 ? '+' : ''}${saturation}`);
    if (brightness !== 0) adjustmentsText.push(`Brightness: ${brightness > 0 ? '+' : ''}${brightness}`);
    
    if (adjustmentsText.length > 0) {
      const prompt = `Apply the following adjustments: ${adjustmentsText.join(', ')}.`;
      if (mode === 'interactive') {
        onApplyColorAdjustment(prompt, isAreaMode ? maskDataUrl : null);
      } else if (onAddToRecipe) {
        onAddToRecipe({
          name: `Color: ${adjustmentsText.join(', ')}`,
          tool: 'color',
          params: { prompt, hue, saturation, brightness }
        });
        onAdjustmentsChange({ hue: 0, saturation: 0, brightness: 0 });
      }
    }
  };

  const isChanged = hue !== 0 || saturation !== 0 || brightness !== 0;
  const canApply = isLoading || !isChanged || (isAreaMode && !maskDataUrl);

  const getSliderBackground = (value: number) => {
    const percentage = ((value + 100) / 200) * 100;
    return `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${percentage}%, #4b5563 ${percentage}%, #4b5563 100%)`;
  };

  const handleToggleAreaMode = () => {
    const newIsAreaMode = !isAreaMode;
    setIsAreaMode(newIsAreaMode);
    if (newIsAreaMode) {
      onToggleMasking(); // Enter masking mode
    }
  }

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-300">Color Adjustments</h3>
        {mode === 'interactive' && (
          <div className="mt-2 w-full max-w-sm bg-gray-900/40 rounded-lg p-1 flex items-center justify-center gap-1">
              <Tooltip text="Apply adjustments to the entire image">
                <button
                    onClick={() => setIsAreaMode(false)}
                    className={`w-full font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                        !isAreaMode
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Global
                </button>
              </Tooltip>
              <Tooltip text="Apply adjustments only to a selected area">
                  <button
                      onClick={() => setIsAreaMode(true)}
                      className={`w-full font-semibold py-2 px-4 rounded-md transition-all duration-200 text-sm ${
                          isAreaMode
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                      Specific Area
                  </button>
              </Tooltip>
          </div>
        )}
      </div>
      
      {isAreaMode && mode === 'interactive' && (
          <div className="flex flex-col items-center gap-2 p-3 bg-gray-900/50 rounded-lg -my-2">
              <p className="text-sm text-gray-400 text-center">
                  {maskDataUrl ? 'An area is selected. Click Apply to continue.' : 'No area selected.'}
              </p>
              <Tooltip text={maskDataUrl ? "Redraw the selected area" : "Select an area to edit"}>
                  <button
                      onClick={onToggleMasking}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                      <PaintBrushIcon className="w-5 h-5"/>
                      {maskDataUrl ? 'Reselect Area' : 'Select Area'}
                  </button>
              </Tooltip>
          </div>
      )}

      <div className="space-y-6">
        {/* Hue Slider */}
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <Tooltip text="Adjust the overall color tint. Shifts all colors around the color wheel.">
                    <label htmlFor="hue" className="font-semibold text-gray-300">Hue</label>
                </Tooltip>
                <span className="text-lg font-mono bg-gray-900/50 px-3 py-1 rounded-md text-gray-200 w-20 text-center">
                    {hue > 0 ? '+' : ''}{hue}
                </span>
            </div>
            <input
                id="hue"
                type="range"
                min="-100"
                max="100"
                value={hue}
                onChange={(e) => onAdjustmentsChange({ ...adjustments, hue: parseInt(e.target.value, 10) })}
                disabled={isLoading}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg"
                style={{ background: getSliderBackground(hue) }}
            />
        </div>

        {/* Saturation Slider */}
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <Tooltip text="Adjust the intensity of the colors. Higher values make colors more vibrant.">
                    <label htmlFor="saturation" className="font-semibold text-gray-300">Saturation</label>
                </Tooltip>
                <span className="text-lg font-mono bg-gray-900/50 px-3 py-1 rounded-md text-gray-200 w-20 text-center">
                    {saturation > 0 ? '+' : ''}{saturation}
                </span>
            </div>
            <input
                id="saturation"
                type="range"
                min="-100"
                max="100"
                value={saturation}
                onChange={(e) => onAdjustmentsChange({ ...adjustments, saturation: parseInt(e.target.value, 10) })}
                disabled={isLoading}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg"
                style={{ background: getSliderBackground(saturation) }}
            />
        </div>

        {/* Brightness Slider */}
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <Tooltip text="Adjust the overall lightness or darkness of the image.">
                    <label htmlFor="brightness" className="font-semibold text-gray-300">Brightness</label>
                </Tooltip>
                <span className="text-lg font-mono bg-gray-900/50 px-3 py-1 rounded-md text-gray-200 w-20 text-center">
                    {brightness > 0 ? '+' : ''}{brightness}
                </span>
            </div>
            <input
                id="brightness"
                type="range"
                min="-100"
                max="100"
                value={brightness}
                onChange={(e) => onAdjustmentsChange({ ...adjustments, brightness: parseInt(e.target.value, 10) })}
                disabled={isLoading}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg"
                style={{ background: getSliderBackground(brightness) }}
            />
        </div>
      </div>

      <div className="pt-2 flex flex-col items-center gap-4">
        <Tooltip text={mode === 'interactive' ? "Apply the selected color adjustments" : "Add these adjustments to the recipe"}>
            <button
                onClick={handleApply}
                className="w-full max-w-sm bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={canApply}
            >
                {mode === 'interactive' ? 'Apply Adjustments' : 'Add to Recipe'}
            </button>
        </Tooltip>
        <Tooltip text="Reset sliders to their default values">
            <button
                onClick={() => onAdjustmentsChange({ hue: 0, saturation: 0, brightness: 0 })}
                disabled={isLoading}
                className="text-sm text-gray-400 hover:text-white transition-colors"
            >
                Reset Sliders
            </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default ColorPanel;
