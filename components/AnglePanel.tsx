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

const AnglePanel: React.FC<AnglePanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer', cameraFocusPoint }) => {
  const [zoomIntensity, setZoomIntensity] = useState(1); // 0: slightly, 1: moderately, 2: significantly
  const [rotation, setRotation] = useState(0); // -180 to 180 degrees
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const circleControlRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const zoomIntensityLabels = ['Слабая', 'Средняя', 'Сильная'];
  const getIntensityWord = (level: number) => {
    return ['незначительно', 'умеренно', 'значительно'][level] || 'умеренно';
  };

  const handleApply = (params: any, name: string) => {
    if (!cameraFocusPoint) return;
    setActiveAction(name);
    
    const finalParams = { ...params, hotspot: cameraFocusPoint };

    if (mode === 'recipe' && onAddToRecipe) {
      onAddToRecipe({
        name,
        tool: 'camera',
        params: finalParams,
      });
    } else {
      onAddLayer({
        name,
        tool: 'camera',
        params: finalParams,
      });
    }
  }

  const handleZoomClick = (direction: 'in' | 'out') => {
    const intensityWord = getIntensityWord(zoomIntensity);
    const name = direction === 'in' ? 'Приблизить' : 'Отдалить';
    const prompt = direction === 'in'
      ? `приблизить камеру ${intensityWord} к главному объекту`
      : `отдалить камеру ${intensityWord}, показывая больше сцены`;
    
    const stepName = `Камера: ${name} (${zoomIntensityLabels[zoomIntensity]})`;
    handleApply({ prompt }, stepName);
  };
  
  const handleApplyRotation = () => {
    if (rotation === 0) return;

    const degrees = Math.abs(rotation);
    const direction = rotation > 0 ? 'вправо' : 'влево';
    let name = `Орбита: ${direction} ${degrees}°`;

    if (degrees > 175) {
      name = 'Орбита 180°';
    }
    
    const prompt = `Regenerate the scene as if the camera performed a horizontal orbital rotation to a new yaw angle of ${rotation} degrees. The current camera view is considered 0 degrees yaw.`;
    
    handleApply({ prompt }, `Камера: ${name}`);
  };

  const handlePresetRotation = (angle: number, name: string) => {
    const prompt = `Regenerate the scene as if the camera performed a horizontal orbital rotation to a new yaw angle of ${angle} degrees. The current camera view is considered 0 degrees yaw.`;
    handleApply({ prompt }, `Камера: ${name}`);
  };
  
  // --- Circular Control Logic ---
  const calculateAngle = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!circleControlRef.current) return;
    const rect = circleControlRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    angle += 90; // Offset so 0 is at the top

    if (angle < 0) {
        angle += 360;
    }

    let finalAngle = Math.round(angle / 5) * 5;
    if (finalAngle > 180 && finalAngle < 360) {
        finalAngle -= 360;
    }
    if (finalAngle === 360) finalAngle = 0;

    setRotation(finalAngle);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const event = 'nativeEvent' in e ? e.nativeEvent : e;
    calculateAngle(event);
  }, [calculateAngle]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (isDragging) {
        e.preventDefault();
        calculateAngle(e);
    }
  }, [isDragging, calculateAngle]);

  useEffect(() => {
    const moveHandler = (e: MouseEvent | TouchEvent) => handleMouseMove(e);
    const upHandler = () => handleMouseUp();
    
    if (isDragging) {
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('touchmove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchend', upHandler);
    }
    return () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
        window.removeEventListener('touchend', upHandler);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
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
            {/* --- Rotation Section --- */}
            <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-stone-50 border border-border-color">
                <h4 className="text-md font-semibold text-text-primary">Орбитальное вращение</h4>
                <p className="text-sm text-text-secondary -mt-2 text-center">
                    Перетащите, чтобы вращать камеру вокруг точки фокуса.
                </p>
                <div 
                    className="relative w-48 h-48 cursor-pointer select-none" 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleMouseDown}
                >
                    <svg ref={circleControlRef} viewBox="0 0 192 192" className="w-full h-full">
                        <circle cx="96" cy="96" r="80" strokeWidth="16" className="stroke-border-color" fill="none" />
                        <circle cx={handleX} cy={handleY} r="12" className="fill-primary" />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <CameraIcon 
                            className="w-12 h-12 text-text-secondary transition-transform duration-0" 
                            style={{ transform: `rotate(${rotation}deg)` }} 
                        />
                        <span className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{rotation}°</span>
                    </div>
                </div>

                <Tooltip side="left" text="Применить выбранное вращение">
                    <button
                        onClick={handleApplyRotation}
                        disabled={isLoading || rotation === 0}
                        className="w-full mt-2 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                    >
                        {isLoading && activeAction?.includes('Орбита') ? <Spinner size="sm"/> : 'Применить вращение'}
                    </button>
                </Tooltip>
            
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm pt-2">
                    <Tooltip side="left" text="Повернуть камеру на 90 градусов влево">
                        <button onClick={() => handlePresetRotation(-90, 'Орбита -90°')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                            {isLoading && activeAction === 'Камера: Орбита -90°' ? <Spinner size="sm" /> : 'Орбита -90°'}
                        </button>
                    </Tooltip>
                    <Tooltip side="left" text="Развернуться на 180 градусов">
                        <button onClick={() => handlePresetRotation(180, 'Орбита 180°')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                            {isLoading && activeAction === 'Камера: Орбита 180°' ? <Spinner size="sm" /> : 'Орбита 180°'}
                        </button>
                    </Tooltip>
                    <Tooltip side="left" text="Повернуть камеру на 90 градусов вправо">
                        <button onClick={() => handlePresetRotation(90, 'Орбита +90°')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                            {isLoading && activeAction === 'Камера: Орбита +90°' ? <Spinner size="sm" /> : 'Орбита +90°'}
                        </button>
                    </Tooltip>
                </div>
            </div>
            
            {/* --- Zoom Section --- */}
            <div className="flex flex-col gap-4 items-center p-4 rounded-lg bg-stone-50 border border-border-color">
                <h4 className="text-md font-semibold text-text-primary">Масштаб</h4>
                <div className="w-full max-w-sm flex flex-col gap-2">
                    <label htmlFor="intensity" className="font-semibold text-text-primary text-center block">
                        Интенсивность: <span className="font-bold text-secondary">{zoomIntensityLabels[zoomIntensity]}</span>
                    </label>
                    <Tooltip side="left" text={`Текущая интенсивность: ${zoomIntensityLabels[zoomIntensity]}. Определяет, насколько сильным будет эффект масштабирования.`}>
                        <input
                            id="intensity"
                            type="range"
                            min="0"
                            max="2"
                            step="1"
                            value={zoomIntensity}
                            onChange={(e) => setZoomIntensity(parseInt(e.target.value, 10))}
                            disabled={isLoading}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer"
                        />
                    </Tooltip>
                </div>
                <div className="flex items-center gap-3">
                    <Tooltip side="left" text="Приблизить: Подвинуть камеру ближе к объекту">
                        <button
                            onClick={() => handleZoomClick('in')}
                            disabled={isLoading}
                            className="flex items-center gap-2 w-full text-center bg-stone-50 text-text-primary font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-stone-200 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed border border-border-color h-12"
                        >
                            {isLoading && activeAction?.includes('Приблизить') ? <Spinner size="sm"/> : <><MagnifyingGlassPlusIcon className="w-6 h-6" /> Приблизить</>}
                        </button>
                    </Tooltip>
                    <Tooltip side="left" text="Отдалить: Подвинуть камеру дальше, показывая больше сцены">
                        <button
                            onClick={() => handleZoomClick('out')}
                            disabled={isLoading}
                            className="flex items-center gap-2 w-full text-center bg-stone-50 text-text-primary font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-stone-200 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed border border-border-color h-12"
                        >
                            {isLoading && activeAction?.includes('Отдалить') ? <Spinner size="sm"/> : <><MagnifyingGlassMinusIcon className="w-6 h-6" /> Отдалить</>}
                        </button>
                    </Tooltip>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default AnglePanel;