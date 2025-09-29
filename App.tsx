/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import {
  generateImageFromPrompt,
  generateFilteredImage,
  generateAdjustedImage,
  generateEditedImage,
  generateReplacedBackground,
  generateReplacedBackgroundFromImage,
  generateTransparentBackground,
  generateClothingChange,
  generateEnhancedImage,
  generateAreaEnhancement,
  generateFaceSwap,
  generateNewAngleImage,
  generateAddedPerson,
  generateAddedObjectFromText,
  generateAddedObjectFromUpload,
  generateColorAdjustedImage,
  generateColorizedImage,
  generateExpandedImage,
  generateUncroppedImage,
  generateFacialEnhancement,
  generateMixedImage,
  generateStyledImage,
} from './services/geminiService';
import { Tool, Hotspot, EditorMode, CustomStyle } from './types';
import { dataURLtoFile, createStyleThumbnail } from './utils';

// Import components
import Header from './components/Header';
import StartScreen from './components/StartScreen';
import EditorCanvas, { EditorCanvasHandles } from './components/EditorCanvas';
import Toolbar from './components/Toolbar';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import BackgroundPanel from './components/BackgroundPanel';
import ClothingPanel from './components/ClothingPanel';
import EnhancePanel from './components/EnhancePanel';
import FaceSwapPanel from './components/FaceSwapPanel';
import AnglePanel from './components/AnglePanel';
import AddPersonPanel from './components/AddPersonPanel';
import AddObjectPanel from './components/AddObjectPanel';
import ColorPanel from './components/ColorPanel';
import ExpandPanel from './components/ExpandPanel';
import Spinner from './components/Spinner';
import Tooltip from './components/Tooltip';
import BatchEditor from './components/BatchEditor';
import MaskingPanel from './components/MaskingPanel';
import RetouchPanel from './components/RetouchPanel';
import FacialPanel from './components/FacialPanel';
import MixPanel from './components/MixPanel';
import RemoveBackgroundPanel from './components/RemoveBackgroundPanel';
import ColorizePanel from './components/ColorizePanel';
import TrainPanel from './components/TrainPanel';

const HISTORY_STORAGE_KEY = 'pixshop-session';
const STYLES_STORAGE_KEY = 'pixshop-custom-styles';
const MAX_HISTORY_LENGTH = 10; // Limit both in-memory and stored history

const App: React.FC = () => {
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<Tool>(null);
    
    const [editHotspot, setEditHotspot] = useState<Hotspot | null>(null);

    // Batch Mode
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    
    // Masking
    const [editorMode, setEditorMode] = useState<EditorMode>('normal');
    const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
    const [maskBrushSize, setMaskBrushSize] = useState(40);
    const [isErasing, setIsErasing] = useState(false);

    // Cropping
    const [aspect, setAspect] = useState<number | undefined>();
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const editorCanvasRef = useRef<EditorCanvasHandles>(null);

    // Custom AI Styles
    const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
    
    // Real-time color adjustments for preview
    const [colorAdjustments, setColorAdjustments] = useState({ hue: 0, saturation: 0, brightness: 0 });

    // Side-by-side comparison mode
    const [isComparing, setIsComparing] = useState(false);

    // Interactive background effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const { clientX, clientY } = e;
          const { innerWidth, innerHeight } = window;
          const x = (clientX / innerWidth) - 0.5;
          const y = (clientY / innerHeight) - 0.5;
          
          document.documentElement.style.setProperty('--mouse-x', x.toString());
          document.documentElement.style.setProperty('--mouse-y', y.toString());
        };
    
        window.addEventListener('mousemove', handleMouseMove);
    
        return () => {
          window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // Load session history from local storage
    useEffect(() => {
        if (isBatchMode) return;
        try {
            const savedSession = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (savedSession) {
                const { history: savedHistory, historyIndex: savedIndex } = JSON.parse(savedSession);
                if (Array.isArray(savedHistory) && typeof savedIndex === 'number' && savedHistory.length > 0) {
                    setHistory(savedHistory);
                    setHistoryIndex(savedIndex);
                }
            }
        } catch (err) {
            console.error("Failed to load session from local storage:", err);
            localStorage.removeItem(HISTORY_STORAGE_KEY);
        }
    }, [isBatchMode]);

    // Save session history to local storage
    useEffect(() => {
        if (isBatchMode || history.length === 0) {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            return;
        }

        // Make a copy to mutate
        let historyToSave = [...history];
        let indexToSave = historyIndex;

        while (historyToSave.length > 0) {
            try {
                const sessionData = JSON.stringify({ history: historyToSave, historyIndex: indexToSave });
                localStorage.setItem(HISTORY_STORAGE_KEY, sessionData);
                
                if (historyToSave.length < history.length) {
                    console.warn(`Session saved, but history was truncated from ${history.length} to ${historyToSave.length} items to fit storage quota.`);
                }
                return; // Success, exit the effect
            } catch (err: any) {
                if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
                    if (historyToSave.length > 1) {
                        console.warn(`Quota exceeded with ${historyToSave.length} items. Removing oldest and retrying.`);
                        historyToSave.shift(); // Remove the oldest item
                        indexToSave = Math.max(0, indexToSave - 1); // Decrement index if it was affected
                    } else {
                        console.error("Failed to save session: a single image history item exceeds local storage quota.");
                        localStorage.removeItem(HISTORY_STORAGE_KEY);
                        return;
                    }
                } else {
                    console.error("Failed to save session to local storage:", err);
                    return;
                }
            }
        }
    }, [history, historyIndex, isBatchMode]);
    
    // Load custom styles from local storage
    useEffect(() => {
        try {
            const savedStyles = localStorage.getItem(STYLES_STORAGE_KEY);
            if (savedStyles) {
                const parsedStyles = JSON.parse(savedStyles);
                if (Array.isArray(parsedStyles)) {
                    setCustomStyles(parsedStyles);
                }
            }
        } catch (err) {
            console.error("Failed to load custom styles from local storage:", err);
            localStorage.removeItem(STYLES_STORAGE_KEY);
        }
    }, []);

    // Save custom styles to local storage
    useEffect(() => {
        try {
            const stylesData = JSON.stringify(customStyles);
            localStorage.setItem(STYLES_STORAGE_KEY, stylesData);
        } catch (err) {
            console.error("Failed to save custom styles to local storage:", err);
        }
    }, [customStyles]);


    const currentImageSrc = history[historyIndex] || null;
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const updateImageState = (newSrc: string) => {
        const newHistoryBase = history.slice(0, historyIndex + 1);
        let newHistory = [...newHistoryBase, newSrc];

        if (newHistory.length > MAX_HISTORY_LENGTH) {
            newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH);
        }

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setActiveTool(null);
        setEditHotspot(null);
        setMaskDataUrl(null);
        setColorAdjustments({ hue: 0, saturation: 0, brightness: 0 });
        setIsComparing(false);
    };
    
    const handleFileSelect = useCallback((files: FileList | null) => {
        if (files && files.length > 0) {
            setError(null);
            setActiveTool(null);
            
            if (files.length > 1) {
                setBatchFiles(Array.from(files));
                setIsBatchMode(true);
                setHistory([]);
                setHistoryIndex(-1);
            } else {
                setIsBatchMode(false);
                setBatchFiles([]);
                const file = files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    setHistory([result]);
                    setHistoryIndex(0);
                };
                reader.readAsDataURL(file);
            }
        }
    }, []);

    const executeAIAction = async (action: () => Promise<string>) => {
        setIsLoading(true);
        setError(null);
        try {
            const newImageSrc = await action();
            updateImageState(newImageSrc);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setEditHotspot(null);
        }
    };
    
    const handleGenerateFromPrompt = useCallback(async (prompt: string) => {
        await executeAIAction(() => generateImageFromPrompt(prompt));
    }, []);

    const withCurrentImageFile = (callback: (file: File) => Promise<string>) => {
        return () => {
            if (!currentImageSrc) throw new Error("No image to edit.");
            const currentImageFile = dataURLtoFile(currentImageSrc, 'pixshop-current.png');
            return callback(currentImageFile);
        };
    };

    const handleApplyFilter = useCallback(async (prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateFilteredImage(file, prompt)));
    }, [currentImageSrc]);

    const handleApplyCustomStyle = useCallback(async (styleId: string) => {
        const style = customStyles.find(s => s.id === styleId);
        if (!style) {
            setError("Could not find the selected custom style.");
            return;
        }
        await executeAIAction(withCurrentImageFile(file => {
            const referenceFiles = style.referenceImageUrls.map((url, i) => 
                dataURLtoFile(url, `style-ref-${i}.png`)
            );
            return generateStyledImage(file, referenceFiles);
        }));
    }, [currentImageSrc, customStyles]);


    const handleApplyAdjustment = useCallback(async (prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateAdjustedImage(file, prompt)));
    }, [currentImageSrc]);

    const handleApplyColorAdjustment = useCallback(async (prompt: string, mask: string | null) => {
      await executeAIAction(withCurrentImageFile(file => {
          const maskFile = mask ? dataURLtoFile(mask, 'mask.png') : undefined;
          return generateColorAdjustedImage(file, prompt, maskFile);
      }));
    }, [currentImageSrc]);

    const handleColorSliderChange = (newAdjustments: { hue: number; saturation: number; brightness: number; }) => {
        setColorAdjustments(newAdjustments);
    };

    const handleApplyColorize = useCallback(async (prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateColorizedImage(file, prompt)));
    }, [currentImageSrc]);

    const handleApplyRetouch = useCallback(async (prompt: string, mask: string) => {
        await executeAIAction(withCurrentImageFile(file => {
            const maskFile = dataURLtoFile(mask, 'mask.png');
            return generateEditedImage(file, prompt, maskFile);
        }));
    }, [currentImageSrc]);
    
    const handleApplyFacialEnhancement = useCallback(async (prompt: string, mask: string) => {
        await executeAIAction(withCurrentImageFile(file => {
            const maskFile = dataURLtoFile(mask, 'mask.png');
            return generateFacialEnhancement(file, prompt, maskFile);
        }));
    }, [currentImageSrc]);

    const handleApplyBackground = useCallback(async (prompt:string) => {
        await executeAIAction(withCurrentImageFile(file => generateReplacedBackground(file, prompt)));
    }, [currentImageSrc]);
    
    const handleApplyBackgroundImage = useCallback(async (backgroundFile: File) => {
        await executeAIAction(withCurrentImageFile(file => generateReplacedBackgroundFromImage(file, backgroundFile)));
    }, [currentImageSrc]);

    const handleApplyTransparentBackground = useCallback(async () => {
        await executeAIAction(withCurrentImageFile(file => generateTransparentBackground(file)));
    }, [currentImageSrc]);
    
    const handleApplyClothing = useCallback(async (clothingFile: File, prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateClothingChange(file, clothingFile, prompt)));
    }, [currentImageSrc]);
    
    const handleApplyMix = useCallback(async (itemFiles: File[], prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateMixedImage(file, itemFiles, prompt)));
    }, [currentImageSrc]);

    const handleApplyFaceSwap = useCallback(async (faceFiles: File[]) => {
        await executeAIAction(withCurrentImageFile(file => generateFaceSwap(file, faceFiles)));
    }, [currentImageSrc]);
    
    const handleApplyAngleChange = useCallback(async (cameraMovement: string) => {
        await executeAIAction(withCurrentImageFile(file => generateNewAngleImage(file, cameraMovement)));
    }, [currentImageSrc]);

    const handleApplyExpansion = useCallback(async (direction: 'up' | 'down' | 'left' | 'right', percentage: number) => {
        await executeAIAction(withCurrentImageFile(file => generateExpandedImage(file, direction, percentage)));
    }, [currentImageSrc]);

    const handleApplyUncrop = useCallback(async (percentage: number) => {
        await executeAIAction(withCurrentImageFile(file => generateUncroppedImage(file, percentage)));
    }, [currentImageSrc]);

    const handleApplyEnhancement = useCallback(async () => {
        await executeAIAction(withCurrentImageFile(file => generateEnhancedImage(file)));
    }, [currentImageSrc]);

    const handleApplyAreaEnhancement = useCallback(async (prompt: string) => {
        if (!editHotspot) return;
        await executeAIAction(withCurrentImageFile(file => generateAreaEnhancement(file, prompt, editHotspot)));
    }, [currentImageSrc, editHotspot]);

    const handleApplyAddPerson = useCallback(async (personFile: File, prompt: string) => {
        await executeAIAction(withCurrentImageFile(file => generateAddedPerson(file, personFile, prompt)));
    }, [currentImageSrc]);

    const handleApplyAddObjectFromText = useCallback(async (prompt: string) => {
        if (!editHotspot) return;
        await executeAIAction(withCurrentImageFile(file => generateAddedObjectFromText(file, prompt, editHotspot)));
    }, [currentImageSrc, editHotspot]);
    
    const handleApplyAddObjectFromUpload = useCallback(async (objectFile: File) => {
        if (!editHotspot) return;
        await executeAIAction(withCurrentImageFile(file => generateAddedObjectFromUpload(file, objectFile, editHotspot)));
    }, [currentImageSrc, editHotspot]);
    
    const filesToDataURLs = (files: File[]): Promise<string[]> => {
        const promises = files.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });
        return Promise.all(promises);
    };

    const handleTrainStyle = async (name: string, files: File[]) => {
        setIsLoading(true);
        setError(null);
        try {
            const referenceImageUrls = await filesToDataURLs(files);
            const thumbnailUrl = await createStyleThumbnail(referenceImageUrls);
            const newStyle: CustomStyle = {
                id: `style-${Date.now()}`,
                name,
                referenceImageUrls,
                thumbnailUrl,
            };
            setCustomStyles(prev => [...prev, newStyle]);
            setActiveTool('filter'); // Switch to filter panel to see the new style
        } catch (err: any) {
            console.error("Failed to train style:", err);
            setError("Could not process images for style training. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteStyle = (styleId: string) => {
        if (window.confirm("Are you sure you want to delete this custom style?")) {
            setCustomStyles(prev => prev.filter(s => s.id !== styleId));
        }
    };

    const handleUndo = () => {
        if (canUndo) setHistoryIndex(historyIndex - 1);
    };
    
    const handleRedo = () => {
        if (canRedo) setHistoryIndex(historyIndex + 1);
    };
    
    const handleDownload = () => {
        if (!currentImageSrc) return;
        const link = document.createElement('a');
        link.href = currentImageSrc;
        link.download = `pixshop-edit-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleNewImage = () => {
        setHistory([]);
        setHistoryIndex(-1);
        setActiveTool(null);
        setError(null);
        setIsBatchMode(false);
        setBatchFiles([]);
        setMaskDataUrl(null);
        setEditorMode('normal');
        setIsComparing(false);
        localStorage.removeItem(HISTORY_STORAGE_KEY);
    };
    
    const handleHotspotClick = (hotspot: Hotspot) => {
        setEditHotspot(hotspot);
        if (activeTool !== 'enhance' && activeTool !== 'addObject') {
            setActiveTool('enhance');
        }
    };
    
    const handleApplyCrop = () => {
        const image = editorCanvasRef.current?.getImage();
        if (!completedCrop || !image || !currentImageSrc) {
            return;
        }

        const canvas = document.createElement('canvas');
        const { naturalWidth, naturalHeight, width, height } = image;

        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = width / height;
        
        let renderedImgWidth: number, renderedImgHeight: number, offsetX = 0, offsetY = 0;

        if (imageAspectRatio > containerAspectRatio) {
            renderedImgWidth = width;
            renderedImgHeight = width / imageAspectRatio;
            offsetY = (height - renderedImgHeight) / 2;
        } else {
            renderedImgHeight = height;
            renderedImgWidth = height * imageAspectRatio;
            offsetX = (width - renderedImgWidth) / 2;
        }

        const scaleX = naturalWidth / renderedImgWidth;
        const scaleY = naturalHeight / renderedImgHeight;

        const cropX = Math.max(0, completedCrop.x - offsetX) * scaleX;
        const cropY = Math.max(0, completedCrop.y - offsetY) * scaleY;

        const cropWidth = completedCrop.width * scaleX;
        const cropHeight = completedCrop.height * scaleY;
        
        if (cropWidth <= 0 || cropHeight <= 0) {
            setError("Invalid crop dimensions. Please try again.");
            return;
        }

        canvas.width = Math.floor(cropWidth);
        canvas.height = Math.floor(cropHeight);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError("Could not get canvas context for cropping.");
            return;
        }

        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            image,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const newImageSrc = canvas.toDataURL('image/png');
        updateImageState(newImageSrc);
        setCompletedCrop(null);
        setCrop(undefined);
        setActiveTool(null);
    };

    const handleToolSelect = (tool: Tool) => {
        const newActiveTool = activeTool === tool ? null : tool;
        if (newActiveTool !== 'crop') {
            setCrop(undefined);
            setCompletedCrop(null);
        }
        setEditorMode('normal');
        setMaskDataUrl(null);
        setActiveTool(newActiveTool);
        setEditHotspot(null);
        setIsComparing(false);
    };

    const handleReset = useCallback(() => {
        if (history.length > 0) {
            setHistoryIndex(0);
        }
    }, [history]);
    
    useEffect(() => {
        if (activeTool === 'crop') {
            const image = editorCanvasRef.current?.getImage();
            if (image && image.naturalWidth > 0) {
                const { naturalWidth, naturalHeight } = image;
                const newCrop = centerCrop(
                    makeAspectCrop(
                        { unit: '%', width: 90 },
                        aspect || naturalWidth / naturalHeight,
                        naturalWidth,
                        naturalHeight
                    ),
                    naturalWidth,
                    naturalHeight
                );
                setCrop(newCrop);
            }
        }
    }, [activeTool, aspect]);

    const renderToolPanel = () => {
        if (editorMode === 'masking') {
            return (
                <MaskingPanel 
                    brushSize={maskBrushSize}
                    onBrushSizeChange={setMaskBrushSize}
                    onClearMask={() => setMaskDataUrl(null)}
                    onCancel={() => {
                        setEditorMode('normal');
                        setMaskDataUrl(null);
                    }}
                    onDone={() => setEditorMode('normal')}
                    isErasing={isErasing}
                    onToggleErase={() => setIsErasing(!isErasing)}
                />
            );
        }
        switch (activeTool) {
            case 'crop':
                return <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width} />;
            case 'expand':
                return <ExpandPanel onApplyExpansion={handleApplyExpansion} onApplyUncrop={handleApplyUncrop} isLoading={isLoading} />;
            case 'train':
                return <TrainPanel onTrainStyle={handleTrainStyle} isLoading={isLoading} />;
            case 'filter':
                return <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} customStyles={customStyles} onApplyCustomStyle={handleApplyCustomStyle} onDeleteCustomStyle={handleDeleteStyle} />;
            case 'adjust':
                return <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />;
            case 'color':
                return <ColorPanel 
                            onApplyColorAdjustment={handleApplyColorAdjustment} 
                            isLoading={isLoading} 
                            maskDataUrl={maskDataUrl}
                            onToggleMasking={() => {
                                setMaskDataUrl(null); // Reset mask when starting
                                setEditorMode(editorMode === 'normal' ? 'masking' : 'normal');
                            }}
                            adjustments={colorAdjustments}
                            onAdjustmentsChange={handleColorSliderChange}
                        />;
            case 'colorize':
                return <ColorizePanel onApplyColorize={handleApplyColorize} isLoading={isLoading} />;
            case 'retouch':
                return <RetouchPanel
                            onApplyRetouch={handleApplyRetouch}
                            isLoading={isLoading}
                            maskDataUrl={maskDataUrl}
                            onToggleMasking={() => {
                                setMaskDataUrl(null);
                                setEditorMode('masking');
                            }}
                        />;
            case 'facial':
                return <FacialPanel
                            onApplyFacialEnhancement={handleApplyFacialEnhancement}
                            isLoading={isLoading}
                            maskDataUrl={maskDataUrl}
                            onToggleMasking={() => {
                                setMaskDataUrl(null);
                                setEditorMode('masking');
                            }}
                        />;
            case 'removeBackground':
                return <RemoveBackgroundPanel
                            onApplyTransparentBackground={handleApplyTransparentBackground}
                            isLoading={isLoading}
                        />;
            case 'background':
                return <BackgroundPanel onApplyBackground={handleApplyBackground} onApplyBackgroundImage={handleApplyBackgroundImage} isLoading={isLoading} />;
            case 'clothing':
                return <ClothingPanel onApplyClothing={handleApplyClothing} isLoading={isLoading} />;
            case 'mix':
                return <MixPanel onApplyMix={handleApplyMix} isLoading={isLoading} />;
            case 'enhance':
                return <EnhancePanel onApplyEnhancement={handleApplyEnhancement} onApplyAreaEnhancement={handleApplyAreaEnhancement} editHotspot={editHotspot} isLoading={isLoading} />;
            case 'faceswap':
                return <FaceSwapPanel onApplyFaceSwap={handleApplyFaceSwap} isLoading={isLoading} />;
            case 'camera':
                return <AnglePanel onApplyAngleChange={handleApplyAngleChange} isLoading={isLoading} />;
            case 'addPerson':
                return <AddPersonPanel onApplyAddPerson={handleApplyAddPerson} isLoading={isLoading} />;
            case 'addObject':
                return <AddObjectPanel onApplyAddObjectFromText={handleApplyAddObjectFromText} onApplyAddObjectFromUpload={handleApplyAddObjectFromUpload} editHotspot={editHotspot} isLoading={isLoading} />;
            default:
                return null;
        }
    };

    const renderContent = () => {
        if (isBatchMode) {
            return <BatchEditor files={batchFiles} onExit={handleNewImage} />;
        }

        if (!currentImageSrc) {
            return <StartScreen onFileSelect={handleFileSelect} onGenerateFromPrompt={handleGenerateFromPrompt} isLoading={isLoading} />;
        }

        return (
            <div className="w-full h-full flex flex-row items-start gap-4 animate-fade-in">
                <aside className={`w-96 flex-shrink-0 h-full overflow-y-auto transition-all duration-500 ease-out transform ${activeTool || editorMode === 'masking' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                    {renderToolPanel()}
                </aside>
                <div className="flex-grow h-full flex flex-col items-center justify-center">
                    <EditorCanvas
                        ref={editorCanvasRef}
                        key={currentImageSrc} 
                        imageSrc={currentImageSrc}
                        originalImageSrc={history[0]}
                        onHotspotClick={handleHotspotClick}
                        editHotspot={editHotspot}
                        activeTool={activeTool}
                        crop={crop}
                        onCropChange={setCrop}
                        onCropComplete={setCompletedCrop}
                        aspect={aspect}
                        editorMode={editorMode}
                        maskDataUrl={maskDataUrl}
                        onMaskChange={setMaskDataUrl}
                        brushSize={maskBrushSize}
                        isErasing={isErasing}
                        colorAdjustments={colorAdjustments}
                        isComparing={isComparing}
                        onCompareChange={setIsComparing}
                        canUndo={canUndo}
                    />
                </div>
                <Toolbar 
                    activeTool={activeTool}
                    onToolSelect={handleToolSelect}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    onRedo={handleRedo}
                    canRedo={canRedo}
                    onDownload={handleDownload}
                    onReset={handleReset}
                    onNewImage={handleNewImage}
                />
            </div>
        );
    }
    
    return (
        <div className="bg-gray-900 text-white h-screen flex flex-col font-sans overflow-hidden">
            <Header />
            <main className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {isLoading && !isBatchMode && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                        <Spinner />
                        <p className="mt-4 text-lg text-gray-300 animate-pulse">AI is thinking...</p>
                    </div>
                )}

                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white p-4 rounded-lg shadow-lg z-40 max-w-xl text-center backdrop-blur-sm">
                        <p className="font-bold">An error occurred:</p>
                        <p>{error}</p>
                        <Tooltip text="Dismiss error message">
                            <button onClick={() => setError(null)} className="mt-2 text-sm font-semibold underline">Dismiss</button>
                        </Tooltip>
                    </div>
                )}
                
                {renderContent()}

            </main>
        </div>
    );
};

export default App;
