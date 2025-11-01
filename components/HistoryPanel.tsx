/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Layer } from '../types';
import { UndoIcon } from './icons';

interface HistoryState {
    past: Layer[][];
    present: Layer[];
    future: Layer[][];
}

interface HistoryPanelProps {
  history: HistoryState;
  onJumpToState: (index: number) => void;
}

const getActionName = (currentState: Layer[], previousState: Layer[] | undefined): string => {
    if (!previousState) {
        return "Базовое изображение";
    }
    if (currentState.length > previousState.length) {
        return currentState[currentState.length - 1].name;
    }
    if (currentState.length < previousState.length) {
        return "Удаление слоя";
    }
    // Simple check for reorder or toggle by comparing layer IDs at the same position
    for (let i = 0; i < currentState.length; i++) {
        if (!previousState[i] || currentState[i].id !== previousState[i].id) {
            return "Изменение порядка слоев";
        }
        if (currentState[i].isVisible !== previousState[i].isVisible) {
            return `Видимость: ${currentState[i].name}`;
        }
    }
    return "Операция со слоем";
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onJumpToState }) => {
    const { past, present, future } = history;
    const fullHistory = [...past, present];
    const presentIndex = past.length;

    return (
        <div className="h-full w-full p-4 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-center text-text-primary">История действий</h3>
            <p className="text-sm text-center text-text-secondary -mt-2">
                Нажмите на действие, чтобы вернуться к этому состоянию.
            </p>
            <div className="flex-grow overflow-y-auto pr-2 border-t border-border-color pt-2">
                <ul className="flex flex-col-reverse gap-1">
                    {/* Future States (undone actions) */}
                    {future.slice().reverse().map((state, i) => {
                        const futureIndex = future.length - 1 - i;
                        const historyIndex = presentIndex + 1 + futureIndex;
                        const previousState = historyIndex > 0 ? [...fullHistory, ...future][historyIndex - 1] : [];
                        const name = getActionName(state, previousState);
                        
                        return (
                            <li key={`future-${i}`}>
                                <button
                                    onClick={() => onJumpToState(historyIndex)}
                                    className="w-full text-left p-3 rounded-lg transition-colors text-text-secondary italic hover:bg-gray-100"
                                >
                                    {name}
                                </button>
                            </li>
                        );
                    })}

                    {/* Past and Present States */}
                    {fullHistory.slice().reverse().map((state, i) => {
                        const historyIndex = fullHistory.length - 1 - i;
                        const previousState = historyIndex > 0 ? fullHistory[historyIndex - 1] : undefined;
                        const name = getActionName(state, previousState);
                        const isPresent = historyIndex === presentIndex;

                        return (
                            <li key={`past-${historyIndex}`}>
                                <button
                                    onClick={() => onJumpToState(historyIndex)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors border-2 ${
                                        isPresent
                                            ? 'bg-blue-100 border-primary text-primary font-bold'
                                            : 'bg-gray-50 border-transparent text-text-primary font-medium hover:bg-gray-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {isPresent && <UndoIcon className="w-5 h-5 flex-shrink-0 transform rotate-180" />}
                                        <span className="truncate">{name}</span>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

export default HistoryPanel;