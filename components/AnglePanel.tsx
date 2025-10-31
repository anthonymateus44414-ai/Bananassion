/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { Layer, Tool } from '../types';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, CameraIcon } from './icons';
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
}

const AnglePanel: React.FC<AnglePanelProps> = ({ onAddLayer, isLoading, onAddToRecipe, mode = 'layer' }) => {
  const [zoomIntensity, setZoomIntensity] = useState(1); // 0: slightly, 1: moderately, 2: significantly
  const [rotation, setRotation] = useState(0); // -180 to 180 degrees
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const zoomIntensityLabels = ['Слабая', 'Средняя', 'Сильная'];
  const getIntensityWord = (level: number) => {
    return ['незначительно', 'умеренно', 'значительно'][level] || 'умеренно';
  };

  const handleApply = (params: any, name: string) => {
    setActiveAction(name);
    if (mode === 'recipe' && onAddToRecipe) {
      onAddToRecipe({
        name,
        tool: 'camera',
        params,
      });
    } else {
      onAddLayer({
        name,
        tool: 'camera',
        params,
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
    let prompt = '';
    let name = `Повернуть ${direction} на ${degrees}°`;

    if (degrees > 175) {
      prompt = `повернуть камеру на 180 градусов, чтобы показать вид сзади текущей позиции камеры, полностью развернувшись.`;
      name = 'Развернуться';
    } else {
      prompt = `повернуть камеру по горизонтали на ${degrees} градусов ${direction}, показывая сцену с этой новой точки обзора.`;
    }
    
    prompt += ` Главный объект должен по возможности оставаться в кадре. Реалистично сгенерируйте любую новую среду, которая станет видимой.`;
    
    handleApply({ prompt }, `Камера: ${name}`);
    setRotation(0);
  };

  const handlePresetRotation = (angle: number, name: string) => {
    const degrees = Math.abs(angle);
    const direction = angle > 0 ? 'вправо' : 'влево';
    let prompt = `повернуть камеру по горизонтали на ${degrees} градусов ${direction}.`;
    if(degrees === 180) {
        prompt = `повернуть камеру на 180 градусов, чтобы показать вид сзади.`;
    }

    handleApply({ prompt }, `Камера: ${name}`);
  };

  return (
    <div className="w-full bg-bg-panel rounded-2xl shadow-lg p-4 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-center text-text-primary">Интерактивная камера</h3>
      
      {/* --- Rotation Section --- */}
      <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-stone-50 border border-border-color">
          <h4 className="text-md font-semibold text-text-primary">Вращение</h4>
          <p className="text-sm text-text-secondary -mt-2 text-center">
            Перетащите ползунок, чтобы выбрать угол, затем нажмите Применить.
          </p>
          <div className="w-full max-w-xs flex flex-col items-center gap-4">
              <Tooltip side="left" text={`Вращение: ${rotation}°`}>
                  <div className="w-24 h-24 bg-bg-panel rounded-full border-2 border-border-color flex items-center justify-center">
                      <CameraIcon className="w-12 h-12 text-text-secondary transition-transform duration-100" style={{ transform: `rotate(${rotation}deg)` }} />
                  </div>
              </Tooltip>

              <input
                  id="rotation"
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                  disabled={isLoading}
                  className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex justify-between w-full text-xs text-text-secondary">
                  <span>-180°</span>
                  <span className="font-bold text-text-primary">{rotation}°</span>
                  <span>+180°</span>
              </div>
              <Tooltip side="left" text="Применить выбранное вращение">
                  <button
                      onClick={handleApplyRotation}
                      disabled={isLoading || rotation === 0}
                      className="w-full mt-2 bg-primary text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-primary-hover active:scale-[0.98] text-base disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center h-12"
                  >
                      {isLoading && activeAction?.includes('Rotate') ? <Spinner size="sm"/> : 'Применить вращение'}
                  </button>
              </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm pt-2">
              <Tooltip side="left" text="Повернуть камеру на 90 градусов влево">
                  <button onClick={() => handlePresetRotation(-90, 'Камера: Повернуть влево')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                    {isLoading && activeAction === 'Камера: Повернуть влево' ? <Spinner size="sm" /> : 'Повернуть влево'}
                  </button>
              </Tooltip>
              <Tooltip side="left" text="Развернуться на 180 градусов">
                  <button onClick={() => handlePresetRotation(180, 'Камера: Развернуться')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                    {isLoading && activeAction === 'Камера: Развернуться' ? <Spinner size="sm" /> : 'Развернуться'}
                  </button>
              </Tooltip>
              <Tooltip side="left" text="Повернуть камеру на 90 градусов вправо">
                  <button onClick={() => handlePresetRotation(90, 'Камера: Повернуть вправо')} disabled={isLoading} className="w-full h-12 text-center bg-stone-50 text-text-primary font-semibold py-3 px-2 rounded-md transition-colors hover:bg-stone-200 active:scale-[0.98] disabled:opacity-50 border border-border-color flex items-center justify-center">
                    {isLoading && activeAction === 'Камера: Повернуть вправо' ? <Spinner size="sm" /> : 'Повернуть вправо'}
                  </button>
              </Tooltip>
          </div>
      </div>
      
       {/* --- Zoom Section --- */}
      <div className="flex flex-col gap-4 items-center p-4 rounded-lg bg-stone-50 border border-border-color">
        <h4 className="text-md font-semibold text-text-primary">Масштаб</h4>
        <div className="w-full max-w-sm flex flex-col gap-2">
            <Tooltip side="left" text="Определяет, насколько сильным будет эффект масштабирования.">
                <label htmlFor="intensity" className="font-semibold text-text-primary text-center block">
                    Интенсивность: <span className="font-bold text-secondary">{zoomIntensityLabels[zoomIntensity]}</span>
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
                className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer"
            />
        </div>
        <div className="flex items-center gap-3">
            <Tooltip side="left" text="Приблизить: Подвинуть камеру ближе к объекту">
                <button
                    onClick={() => handleZoomClick('in')}
                    disabled={isLoading}
                    className="flex items-center gap-2 w-full text-center bg-stone-50 text-text-primary font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-stone-200 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed border border-border-color h-12"
                >
                    {isLoading && activeAction?.includes('Zoom In') ? <Spinner size="sm"/> : <><MagnifyingGlassPlusIcon className="w-6 h-6" /> Приблизить</>}
                </button>
            </Tooltip>
            <Tooltip side="left" text="Отдалить: Подвинуть камеру дальше, показывая больше сцены">
                 <button
                    onClick={() => handleZoomClick('out')}
                    disabled={isLoading}
                    className="flex items-center gap-2 w-full text-center bg-stone-50 text-text-primary font-semibold p-3 rounded-md transition-all duration-200 ease-in-out hover:bg-stone-200 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed border border-border-color h-12"
                >
                    {isLoading && activeAction?.includes('Zoom Out') ? <Spinner size="sm"/> : <><MagnifyingGlassMinusIcon className="w-6 h-6" /> Отдалить</>}
                </button>
            </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default AnglePanel;