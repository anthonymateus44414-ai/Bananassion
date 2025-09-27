/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { PaintBrushIcon } from './icons';

interface RetouchPanelProps {
  onApplyRetouch: (prompt: string, mask: string) => void;
  isLoading: boolean;
  maskDataUrl: string | null;
  onToggleMasking: () => void;
}

const RetouchPanel: React.FC<RetouchPanelProps> = ({ 
  onApplyRetouch, 
  isLoading,
  maskDataUrl,
  onToggleMasking
}) => {
    const [retouchPrompt, setRetouchPrompt] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (maskDataUrl && retouchPrompt.trim()) {
            onApplyRetouch(retouchPrompt, maskDataUrl);
            setRetouchPrompt('');
        }
    };

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-center text-gray-300">Retouch Area</h3>
            <p className="text-sm text-center text-gray-400 -mt-2">
                {maskDataUrl ? "An area is selected. Describe the change below." : "Select an area on the image to edit."}
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

                <form onSubmit={handleSubmit} className="w-full flex gap-2">
                   <Tooltip text="Describe the change, e.g., 'remove the car', 'change shirt color to blue'">
                        <input
                            type="text"
                            value={retouchPrompt}
                            onChange={(e) => setRetouchPrompt(e.target.value)}
                            placeholder="e.g., 'remove this blemish'"
                            className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                            disabled={isLoading || !maskDataUrl}
                            autoFocus
                        />
                    </Tooltip>
                    <Tooltip text="Apply the retouching prompt to the selected area">
                        <button
                            type="submit"
                            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-95 disabled:opacity-50"
                            disabled={isLoading || !retouchPrompt.trim() || !maskDataUrl}
                        >
                            Apply
                        </button>
                    </Tooltip>
                </form>
            </div>
        </div>
    );
};

export default RetouchPanel;