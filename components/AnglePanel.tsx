/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, MouseEvent } from 'react';
import Tooltip from './Tooltip';
import { Tool } from '../types';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from './icons';

interface AnglePanelProps {
  onApplyAngleChange: (prompt: string) => void;
  isLoading: boolean;
  mode?: 'interactive' | 'recipe';
  onAddToRecipe?: (step: { name: string; tool: Tool; params: { prompt: string } }) => void;
}

const AnglePanel: React.FC<AnglePanelProps> = ({ onApplyAngleChange, isLoading, mode = 'interactive', onAddToRecipe }) => {
  const [zoomIntensity, setZoomIntensity] = useState(1); // 0: slightly, 1: moderately, 2: significantly
  const [puckPosition, setPuckPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const controlPadRef = useRef<HTMLDivElement>(null);

  const zoomIntensityLabels = ['Subtle', 'Moderate', 'Significant'];
  const getIntensityWord = (level: number) => {
    return ['slightly', 'moderately', 'significantly'][level] || 'moderately';
  };

  const handleZoomClick = (direction: 'in' | 'out') => {
    const intensityWord = getIntensityWord(zoomIntensity);
    const name = direction === 'in' ? 'Dolly In' : 'Pan Out';
    const prompt = direction === 'in'
      ? `dolly the camera in ${intensityWord} closer to the main subject`
      : `pan the camera out ${intensityWord}, revealing more of the scene`;
    
    if (mode === 'interactive') {
      onApplyAngleChange(prompt);
    } else if (onAddToRecipe) {
      const stepName = `${name} (${zoomIntensityLabels[zoomIntensity]})`;
      onAddToRecipe({
        name: `Camera: ${stepName}`,
        tool: 'camera',
        params: { prompt }
      });
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!controlPadRef.current || isLoading || mode !== 'interactive') return;
    setIsDragging(true);
    updatePuckPosition(e);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !controlPadRef.current || isLoading) return;
    updatePuckPosition(e);
  };
  
  const updatePuckPosition = (e: MouseEvent<HTMLDivElement>) => {
    const rect = controlPadRef.current!.getBoundingClientRect();
    const size = rect.width;
    const halfSize = size / 2;
    
    let x = e.clientX - rect.left - halfSize;
    let y = e.clientY - rect.top - halfSize;

    const distance = Math.sqrt(x * x + y * y);

    // Constrain puck within the circle
    if (distance > halfSize) {
      x = (x / distance) * halfSize;
      y = (y / distance) * halfSize;
    }
    
    setPuckPosition({ x, y });
  };
  
  const handleMouseUpOrLeave = () => {
    if (!isDragging || mode !== 'interactive') return;

    const { x, y } = puckPosition;
    const rect = controlPadRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const halfSize = rect.width / 2;
    const distance = Math.sqrt(x * x + y * y);

    // Only trigger if dragged past a minimum threshold
    if (distance > 10) {
        const intensityRatio = distance / halfSize;
        let intensityWord = 'moderately';
        
        if (intensityRatio > 0.66) {
            intensityWord = 'significantly';
        } else if (intensityRatio > 0.33) {
            intensityWord = 'moderately';
        } else {
            intensityWord = 'slightly';
        }

        const isHorizontalDominant = Math.abs(x) > Math.abs(y) * 1.5;
        const isVerticalDominant = Math.abs(y) > Math.abs(x) * 1.5;

        let horizontalMove = '';
        if (x > 10) {
            horizontalMove = 'rotate the camera angle to the right';
        } else if (x < -10) {
            horizontalMove = 'rotate the camera angle to the left';
        }

        let verticalMove = '';
        if (y > 10) {
            verticalMove = 'move the camera angle down';
        } else if (y < -10) {
            verticalMove = 'move the camera angle up';
        }

        let finalPrompt = '';

        if (horizontalMove && !verticalMove || isHorizontalDominant) {
            finalPrompt = `${horizontalMove} ${intensityWord}`;
        } else if (verticalMove && !horizontalMove || isVerticalDominant) {
            finalPrompt = `${verticalMove} ${intensityWord}`;
        } else if (horizontalMove && verticalMove) { // Diagonal
            finalPrompt = `${horizontalMove} and ${verticalMove} ${intensityWord}`;
        } else {
            // No significant movement, so we bail
            setIsDragging(false);
            setPuckPosition({ x: 0, y: 0 });
            return;
        }
        
        onApplyAngleChange(finalPrompt.trim());
    }

    setIsDragging(false);
    setPuckPosition({ x: 0, y: 0 });
  };


  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Change Camera Angle</h3>
      
      {mode === 'interactive' ? (
        <>
        <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-400">Drag in any direction to pan or rotate.</p>
            <div 
                ref={controlPadRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className={`relative w-48 h-48 bg-gray-900/50 rounded-full cursor-grab transition-all duration-300 ${isDragging ? 'cursor-grabbing' : ''} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} border-2 border-gray-700 shadow-inner flex items-center justify-center`}
                style={{ touchAction: 'none' }}
            >
                {/* Guide lines */}
                <div className="absolute w-full h-px bg-gray-700/50"></div>
                <div className="absolute h-full w-px bg-gray-700/50"></div>
                <div className="absolute w-3/5 h-3/5 border-2 border-dashed border-gray-700/50 rounded-full"></div>

                <div 
                    className="absolute w-12 h-12 bg-blue-500 rounded-full shadow-lg border-2 border-blue-300"
                    style={{ 
                        transform: `translate(${puckPosition.x}px, ${puckPosition.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                    }}
                />
            </div>
        </div>

        <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold">ZOOM</span>
            <div className="flex-grow border-t border-gray-600"></div>
        </div>
        </>
      ) : (
        <p className="text-center text-sm text-gray-400 p-2 bg-gray-900/50 rounded-lg">Interactive camera controls are not available in recipe mode. Use the zoom options below.</p>
      )}

      {/* Zoom Controls */}
      <div className="flex flex-col gap-4 items-center">
        <div className="w-full max-w-sm flex flex-col gap-2">
            <Tooltip text="Controls how strong the zoom effect will be.">
                <label htmlFor="intensity" className="font-semibold text-gray-300 text-center">
                    Zoom Intensity: <span className="font-bold text-blue-400">{zoomIntensityLabels[zoomIntensity]}</span>
                </label>
            </Tooltip>
            <input
                id="intensity"
                type="range"
                min="0"
                max="2"
                step="1"
                value={zoomIntensity}
                onChange={(e) => setZoomIntensity(parseInt(e.target.value, 10))}
                disabled={isLoading}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>
        <div className="flex items-center gap-3">
            <Tooltip text="Dolly In: Move the camera closer to the subject">
                <button
                    onClick={() => handleZoomClick('in')}
                    disabled={isLoading}
                    className="flex items-center gap-2 w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <MagnifyingGlassPlusIcon className="w-6 h-6" />
                    Dolly In
                </button>
            </Tooltip>
            <Tooltip text="Pan Out: Move the camera away, revealing more of the scene">
                 <button
                    onClick={() => handleZoomClick('out')}
                    disabled={isLoading}
                    className="flex items-center gap-2 w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <MagnifyingGlassMinusIcon className="w-6 h-6" />
                    Pan Out
                </button>
            </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default AnglePanel;