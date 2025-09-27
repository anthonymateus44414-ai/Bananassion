/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon } from './icons';

interface FacialPanelProps {
  onApplyFacialEnhancement: (prompt: string, mask: string) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
}

const FacialPanel: React.FC<FacialPanelProps> = ({ 
  onApplyFacialEnhancement, 
  isLoading,
  maskDataUrl,
  onToggleMasking
}) => {
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    const presets = [
        { name: 'Smooth Skin', prompt: 'Subtly smooth the skin texture, reducing blemishes and fine lines for a natural, healthy look. Do not make it look airbrushed or plastic.' },
        { name: 'Brighten Eyes', prompt: 'Make the eyes slightly brighter and more vibrant. Add a subtle sparkle to the pupils to make them pop.' },
        { name: 'Enhance Lips', prompt: 'Slightly increase the saturation and definition of the lips for a fuller, more healthy appearance. Do not change the lip color.' },
        { name: 'Refine Jawline', prompt: 'Subtly contour and define the jawline and chin area for a sharper, more sculpted look.' },
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
            onApplyFacialEnhancement(activePrompt, maskDataUrl);
            setCustomPrompt('');
            setSelectedPreset(null);
        }
    };

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-center text-gray-300">Facial Enhancement</h3>
            <p className="text-sm text-center text-gray-400 -mt-2">
                {maskDataUrl ? "Area selected. Now choose a preset or describe the enhancement." : "Select an area on the image (e.g., skin, eyes) to enhance."}
            </p>

            <div className="flex flex-col items-center gap-4">
                <Tooltip text={maskDataUrl ? "Redraw the selected area" : "Select an area to edit"}>
                    <button
                        onClick={onToggleMasking}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-5 rounded-lg transition-colors text-base"
                        disabled={isLoading}
                    >
                        <PaintBrushIcon className="w-5 h-5"/>
                        {maskDataUrl ? 'Reselect Area' : 'Select Area'}
                    </button>
                </Tooltip>

                {maskDataUrl && (
                    <div className="w-24 h-24 border-2 border-gray-600 rounded-md p-1 bg-black/20">
                        <img src={maskDataUrl} alt="Mask preview" className="w-full h-full object-contain" />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {presets.map(preset => (
                    <Tooltip key={preset.name} text={preset.prompt}>
                        <button
                            onClick={() => handlePresetClick(preset.prompt)}
                            disabled={isLoading || !maskDataUrl}
                            className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
                        >
                        {preset.name}
                        </button>
                    </Tooltip>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="w-full flex gap-2">
                <Tooltip text="Describe a custom enhancement, e.g., 'whiten teeth slightly'">
                    <input
                        type="text"
                        value={customPrompt}
                        onChange={handleCustomChange}
                        placeholder="Or describe an enhancement (e.g., 'reduce wrinkles')"
                        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                        disabled={isLoading || !maskDataUrl}
                    />
                </Tooltip>
                <Tooltip text="Apply the enhancement to the selected area">
                    <button
                        type="submit"
                        className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-95 disabled:opacity-50"
                        disabled={isLoading || !activePrompt.trim() || !maskDataUrl}
                    >
                        Apply
                    </button>
                </Tooltip>
            </form>
        </div>
    );
};

export default FacialPanel;