/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, UserCircleIcon, InformationCircleIcon } from './icons';
import Tooltip from './Tooltip';

interface FaceSwapPanelProps {
  onApplyFaceSwap: (faceFiles: File[]) => void;
  isLoading: boolean;
}

const FaceSwapPanel: React.FC<FaceSwapPanelProps> = ({ onApplyFaceSwap, isLoading }) => {
  const [faceFiles, setFaceFiles] = useState<(File | null)[]>([null, null, null]);
  const [facePreviews, setFacePreviews] = useState<(string | null)[]>([null, null, null]);
  const [isDraggingOver, setIsDraggingOver] = useState<number | null>(null);

  const handleFileChange = (file: File | null, index: number) => {
    if (file) {
      const newFiles = [...faceFiles];
      newFiles[index] = file;
      setFaceFiles(newFiles);

      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...facePreviews];
        newPreviews[index] = reader.result as string;
        setFacePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validFiles = faceFiles.filter(f => f !== null) as File[];
    if (validFiles.length > 0) {
      onApplyFaceSwap(validFiles);
    }
  };

  const hasFiles = faceFiles.some(f => f !== null);

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Face Swap</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">Upload up to 3 reference images of the face from different angles (e.g., front, left side, right side) for a more accurate 3D-aware swap.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(index => (
            <Tooltip key={index} text={`Angle ${index + 1}: For best results, use photos from different angles (front, side)`}>
              <label
                htmlFor={`face-swap-upload-${index}`}
                className={`w-full p-4 h-32 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-colors ${isDraggingOver === index ? 'border-blue-400 bg-blue-500/10' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(index); }}
                onDragLeave={() => setIsDraggingOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(null);
                  handleFileChange(e.dataTransfer.files?.[0] || null, index);
                }}
              >
                {facePreviews[index] ? (
                  <img src={facePreviews[index]} alt={`Face preview ${index + 1}`} className="max-h-full mx-auto rounded-md object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <UploadIcon className="w-8 h-8" />
                    <span className="text-xs">Angle {index + 1}</span>
                  </div>
                )}
              </label>
            </Tooltip>
          ))}
        </div>
        
        {[0, 1, 2].map(index => (
          <input key={index} id={`face-swap-upload-${index}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, index)} disabled={isLoading} />
        ))}

        {faceFiles.filter(f => f).length > 1 && (
            <div className="flex items-center gap-2 text-sm text-cyan-300 bg-cyan-500/10 p-3 rounded-lg animate-fade-in">
                <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
                <span>Note: Using multiple reference images provides higher quality but may take longer to process.</span>
            </div>
        )}

        <Tooltip text="Apply the face swap using the uploaded reference images">
          <button
            type="submit"
            className="w-full bg-gradient-to-br from-teal-600 to-cyan-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-teal-800 disabled:to-cyan-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            disabled={isLoading || !hasFiles}
          >
            <UserCircleIcon className="w-6 h-6"/>
            Apply Face Swap
          </button>
        </Tooltip>
      </form>
    </div>
  );
};

export default FaceSwapPanel;