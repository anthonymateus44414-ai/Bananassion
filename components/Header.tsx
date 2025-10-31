/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { SparklesIcon, DeviceFloppyIcon, FolderOpenIcon, ArrowDownTrayIcon } from './icons';
import Tooltip from './Tooltip';

interface HeaderProps {
  onSaveProject: () => void;
  onLoadProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isFastMode: boolean;
  onFastModeChange: (enabled: boolean) => void;
  onDownload: () => void;
}


const Header: React.FC<HeaderProps> = ({ onSaveProject, onLoadProject, isFastMode, onFastModeChange, onDownload }) => {
  return (
    <header className="w-full py-2 px-6 border-b border-border-color bg-bg-panel sticky top-0 z-50 shadow-sm flex items-center justify-between">
      <div className="flex items-center justify-start w-1/3">
         {/* Left aligned content can go here */}
      </div>
      
      <div className="flex-grow flex items-center justify-center gap-2">
          <SparklesIcon className="w-7 h-7 text-primary" />
          <h1 className="text-3xl text-primary font-extrabold tracking-tight">
            Pixshop
          </h1>
      </div>

      <div className="flex items-center justify-end w-1/3 gap-3">
        <Tooltip side="left" text="Быстрый режим: обрабатывает изображение меньшего размера для более быстрого предпросмотра. Отключите для финального экспорта в высоком качестве.">
            <label htmlFor="fast-mode-toggle" className="inline-flex relative items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    id="fast-mode-toggle" 
                    className="sr-only peer"
                    checked={isFastMode}
                    onChange={(e) => onFastModeChange(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-sm font-semibold text-text-primary">Быстрый режим</span>
            </label>
        </Tooltip>
        
        <div className="h-6 w-px bg-border-color"></div>

        <Tooltip side="left" text="Сохранить проект (.pixshop файл)">
            <button onClick={onSaveProject} className="flex items-center gap-2 font-semibold text-text-primary bg-gray-100 hover:bg-gray-200 transition-colors px-3 py-2 rounded-lg border border-border-color">
                <DeviceFloppyIcon className="w-5 h-5" />
                Сохранить
            </button>
        </Tooltip>
        <Tooltip side="left" text="Загрузить проект (.pixshop файл)">
            <label htmlFor="project-upload" className="flex items-center gap-2 font-semibold text-text-primary bg-gray-100 hover:bg-gray-200 transition-colors px-3 py-2 rounded-lg border border-border-color cursor-pointer">
                <FolderOpenIcon className="w-5 h-5" />
                Загрузить
            </label>
        </Tooltip>
        <input id="project-upload" type="file" className="hidden" accept=".pixshop,application/json" onChange={onLoadProject} />

        <div className="h-6 w-px bg-border-color"></div>

        <Tooltip side="left" text="Скачать финальное изображение (.png файл)">
            <button onClick={onDownload} className="flex items-center gap-2 font-semibold text-white bg-primary hover:bg-primary-hover transition-colors px-4 py-2 rounded-lg shadow-sm">
                <ArrowDownTrayIcon className="w-5 h-5" />
                Скачать
            </button>
        </Tooltip>
      </div>
    </header>
  );
};

export default React.memo(Header);