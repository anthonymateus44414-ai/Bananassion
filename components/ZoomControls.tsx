/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Tooltip from './Tooltip';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from './icons';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ scale, onZoomIn, onZoomOut, onResetZoom }) => {
  const zoomPercentage = Math.round(scale * 100);

  return (
    <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 bg-bg-panel/90 backdrop-blur-sm border border-border-color rounded-lg shadow-lg p-1 text-text-primary">
      <Tooltip text="Отдалить">
        <button
          onClick={onZoomOut}
          className="p-2 rounded-md hover:bg-gray-200 transition-colors"
          aria-label="Отдалить"
        >
          <MagnifyingGlassMinusIcon className="w-6 h-6" />
        </button>
      </Tooltip>
      
      <Tooltip text="Вернуть исходный масштаб">
        <button onClick={onResetZoom} className="px-3 py-2 text-sm font-bold w-20 text-center hover:bg-gray-200 rounded-md transition-colors">
          {zoomPercentage}%
        </button>
      </Tooltip>

      <Tooltip text="Приблизить">
        <button
          onClick={onZoomIn}
          className="p-2 rounded-md hover:bg-gray-200 transition-colors"
          aria-label="Приблизить"
        >
          <MagnifyingGlassPlusIcon className="w-6 h-6" />
        </button>
      </Tooltip>
    </div>
  );
};

export default ZoomControls;
