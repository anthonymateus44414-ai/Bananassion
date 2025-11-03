/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Tooltip from './Tooltip';
import { Layer, Tool, Hotspot } from '../types';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, CameraIcon, CursorArrowRaysIcon } from './icons';
import Spinner from './Spinner';

interface RecipeStep {
  id: string;
  name: string;
  tool: Tool;
  params: any;
}

interface AnglePanelProps {
  onAddLayer: (layer: Omit<Layer, 'id' | 'isVisible'>) => void;
  isLoading: boolean;
  onAddToRecipe?: (step: Omit<RecipeStep, 'id'>) => void;
  mode?: 'layer' | 'recipe';
  cameraFocusPoint: Hotspot | null;
}

// Custom hook for circular drag logic
const useCircularDrag = (initialAngle: number) => {
    const [angle, setAngle] = useState(initialAngle);
    const [isDragging, setIsDragging] = useState(false);
    const controlRef = useRef<SVGSVGElement>(null);

    const calculateAngle = useCallback((e: MouseEvent | TouchEvent) => {
        if (!controlRef.current) return;
        const rect = controlRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaX = (clientX - rect.left) - centerX;
        const deltaY = (clientY - rect.top) - centerY;
        
        let newAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
        if (newAngle < 0) newAngle += 360;
        
        let finalAngle = Math.round(newAngle / 5) * 5;
        if (finalAngle > 180 && finalAngle < 360) finalAngle -= 360;
        if (finalAngle === 360) finalAngle = 0;

        setAngle(finalAngle);
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDragging(true);
        calculateAngle('nativeEvent' in e ? e.nativeEvent : e);
    }, [calculateAngle]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging) { e.preventDefault(); calculateAngle(e); }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('touchmove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchend', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, calculateAngle]);

    return { controlRef, angle, handleMouseDown };
};

const AnglePanel: React.FC<AnglePanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer', cameraFocusPoint }) => {
  const [zoomIntensity, setZoomIntensity] = useState(1);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { controlRef, angle: rotation, handleMouseDown } = useCircularDrag(0);

  const zoomIntensityLabels = ['Слабая', 'Средняя', 'Сильная'];
  const getIntensityWord = (level: number) => ['незначительно', 'умеренно', 'значительно'][level];

  const handleApply = useCallback((params: any, name: string) => {
    if (!cameraFocusPoint) return;
    setActiveAction(name);
    const finalParams = { ...params, hotspot: cameraFocusPoint };

    const action = mode === 'recipe' && onAddToRecipe ? onAddToRecipe : onAddLayer;
    action({ name, tool: 'camera', params: finalParams } as any);
  }, [cameraFocusPoint, mode, onAddToRecipe, onAddLayer]);

  const handleZoomClick = (direction: 'in' | 'out') => {
    const prompt = direction === 'in'
      ? `приблизить камеру ${getIntensityWord(zoomIntensity)} к главному объекту`
      : `отдалить камеру ${getIntensityWord(zoomIntensity)}, показывая больше сцены`;
    const name = `Камера: ${direction === 'in' ? 'Приблизить' : 'Отдалить'} (${zoomIntensityLabels[zoomIntensity]})`;
    handleApply({ prompt }, name);
  };
  
  const handleApplyRotation = () => {
    if (rotation === 0) return;
    const degrees = Math.abs(rotation);
    const direction = rotation > 0 ? 'вправо' : 'влево';
    let name = `Орбита: ${direction} ${degrees}°`;
    if (degrees > 175) name = 'Орбита 180°';
    
    const prompt = `Regenerate the scene as if the camera performed a horizontal orbital rotation to a new yaw angle of ${rotation} degrees. The current camera view is considered 0 degrees yaw.`;
    handleApply({ prompt }, `Камера: ${name}`);
  };

  const handlePresetRotation = (angle: number, name: string) => {
    const prompt = `Regenerate the scene as if the camera performed a horizontal orbital rotation to a new yaw angle of ${angle} degrees. The current camera view is considered 0 degrees yaw.`;
    handleApply({ prompt }, `Камера: ${name}`);
  };
  
  const rotationInRad = rotation * (Math.PI / 180);
  const handleX = 96 + 80 * Math.sin(rotationInRad);
  const handleY = 96 - 80 * Math.cos(rotationInRad);

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Интерактивная камера</h3>
      
      {!cameraFocusPoint ? (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center bg-stone-50 rounded-lg border-2 border-dashed border-border-color">
            <CursorArrowRaysIcon className="w-12 h-12 text-text-secondary" />
            <h4 className="font-bold text-text-primary">Выберите точку фокуса</h4>
            <p className="text-sm text-text-secondary">Кликните на главный объект на изображении, чтобы установить центр вращения камеры.</p>
        </div>
      ) : (
        <>
            <div className="p-3 bg-stone-100 rounded-lg border border-border-color text-center">
                <h4 className="text-sm font-bold text-text-primary">Точка фокуса выбрана</h4>
                <p className="text-xs text-text-secondary font-mono">X: {cameraFocusPoint.x.toFixed(1)}%, Y: {cameraFocusPoint.y.toFixed(1)}%</p>
            </div>
            {/* Rotation Section */}
            <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-stone-50 border border-border-color">
                <h4 className="text-md font-semibold text-text-primary">Орбитальное вращение</h4>
                <div 
                    className="relative w-48 h-48 cursor-pointer select-none" 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleMouseDown}
                >
                    <svg ref={controlRef} viewBox="0 0 192 192" className="w-full h-full">
                        <circle cx="96" cy="96" r="80" strokeWidth="16" className="stroke-border-color" fill="none" />
                        <circle cx={handleX} cy={handleY} r="12" className="fill-primary" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <CameraIcon className="w-12 h-12 text-text-secondary" style={{ transform: `rotate(${rotation}deg)` }} />
                        <span className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{rotation}°</span>
                    </div>
                </div>
                <Tooltip side="left" text="Применить выбранное вращение"><button onClick={handleApplyRotation} disabled={isLoading || rotation === 0} className="w-full mt-2 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all hover:bg-primary-hover active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12">{isLoading && activeAction?.includes('Орбита') ? <Spinner size="sm"/> : 'Применить вращение'}</button></Tooltip>
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm pt-2">
                    {[-90, 180, 90].map(angle => {
                        const name = `Орбита ${angle > 0 ? '+' : ''}${angle}°`;
                        return <Tooltip key={angle} side="left" text={`Повернуть на ${angle}°`}><button onClick={() => handlePresetRotation(angle, name)} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 font-semibold p-2 rounded-md hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">{isLoading && activeAction === `Камера: ${name}` ? <Spinner size="sm" /> : name}</button></Tooltip>
                    })}
                </div>
            </div>
            
            {/* Zoom Section */}
            <div className="flex flex-col gap-4 items-center p-4 rounded-lg bg-stone-50 border border-border-color">
                <h4 className="text-md font-semibold text-text-primary">Масштаб</h4>
                <div className="w-full max-w-sm flex flex-col gap-2">
                    <label htmlFor="intensity" className="font-semibold text-center block">Интенсивность: <span className="font-bold text-secondary">{zoomIntensityLabels[zoomIntensity]}</span></label>
                    <Tooltip side="left" text="Определяет, насколько сильным будет эффект масштабирования."><input id="intensity" type="range" min="0" max="2" step="1" value={zoomIntensity} onChange={(e) => setZoomIntensity(parseInt(e.target.value, 10))} disabled={isLoading} className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer" /></Tooltip>
                </div>
                <div className="flex items-center gap-3">
                    <Tooltip side="left" text="Приблизить"><button onClick={() => handleZoomClick('in')} disabled={isLoading} className="flex items-center gap-2 w-full p-3 rounded-md hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color h-12">{isLoading && activeAction?.includes('Приблизить') ? <Spinner size="sm"/> : <><MagnifyingGlassPlusIcon className="w-6 h-6" /> Приблизить</>}</button></Tooltip>
                    <Tooltip side="left" text="Отдалить"><button onClick={() => handleZoomClick('out')} disabled={isLoading} className="flex items-center gap-2 w-full p-3 rounded-md hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color h-12">{isLoading && activeAction?.includes('Отдалить') ? <Spinner size="sm"/> : <><MagnifyingGlassMinusIcon className="w-6 h-6" /> Отдалить</>}</button></Tooltip>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default AnglePanel;