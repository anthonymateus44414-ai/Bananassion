/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { Hotspot, Tool, EditorMode } from '../types';
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon } from './icons';
import Tooltip from './Tooltip';

interface EditorCanvasProps {
  imageSrc: string | null;
  onHotspotClick: (hotspot: Hotspot) => void;
  editHotspot: Hotspot | null;
  activeTool: Tool;
  crop: Crop | undefined;
  onCropChange: (crop: Crop) => void;
  onCropComplete: (crop: PixelCrop) => void;
  aspect: number | undefined;
  editorMode: EditorMode;
  maskDataUrl: string | null;
  onMaskChange: (dataUrl: string | null) => void;
  brushSize: number;
  isErasing: boolean;
}

export interface EditorCanvasHandles {
  getImage: () => HTMLImageElement | null;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

const EditorCanvas = forwardRef<EditorCanvasHandles, EditorCanvasProps>(({ 
  imageSrc, 
  onHotspotClick, 
  editHotspot, 
  activeTool,
  crop,
  onCropChange,
  onCropComplete,
  aspect,
  editorMode,
  maskDataUrl,
  onMaskChange,
  brushSize,
  isErasing,
}, ref) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingContext = useRef<{ lastX: number, lastY: number } | null>(null);
  
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const ignoreClick = useRef(false);

  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 }); // Start off-screen
  const [isCursorVisible, setIsCursorVisible] = useState(false);

  const [imageGeom, setImageGeom] = useState({
      naturalWidth: 0,
      naturalHeight: 0,
      renderedWidth: 0,
      renderedHeight: 0,
      offsetX: 0,
      offsetY: 0,
  });

  useImperativeHandle(ref, () => ({
    getImage: () => imgRef.current
  }));

  const fitToView = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  useEffect(() => {
    // Reset view when entering crop mode or masking for a predictable experience
    if (activeTool === 'crop' || editorMode === 'masking') {
        fitToView();
    }
  }, [activeTool, editorMode, fitToView]);

  useEffect(() => {
    fitToView();
    setImageGeom({ naturalWidth: 0, naturalHeight: 0, renderedWidth: 0, renderedHeight: 0, offsetX: 0, offsetY: 0 }); 
  }, [imageSrc, fitToView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName.toLowerCase() === 'input' || activeEl.tagName.toLowerCase() === 'textarea');
        if (isTyping) return;

        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            setIsSpacePressed(true);
        }

        // Zoom and Pan shortcuts
        if ((e.ctrlKey || e.metaKey)) {
            let handled = false;
            switch(e.key) {
                case '=':
                case '+':
                    adjustZoom(0.2);
                    handled = true;
                    break;
                case '-':
                    adjustZoom(-0.2);
                    handled = true;
                    break;
                case '0':
                    fitToView();
                    handled = true;
                    break;
            }
            if (handled) {
                e.preventDefault();
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName.toLowerCase() === 'input' || activeEl.tagName.toLowerCase() === 'textarea');
        if (isTyping) return;

        if (e.code === 'Space') {
            e.preventDefault();
            setIsSpacePressed(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fitToView]);

  const calculateImageGeometry = useCallback(() => {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) return;

      const { naturalWidth, naturalHeight } = img;
      const { clientWidth: containerWidth, clientHeight: containerHeight } = container;

      if (naturalWidth === 0 || naturalHeight === 0 || containerWidth === 0 || containerHeight === 0) return;

      const imgRatio = naturalWidth / naturalHeight;
      const containerRatio = containerWidth / containerHeight;

      let renderedWidth, renderedHeight, offsetX, offsetY;
      
      if (imgRatio > containerRatio) {
          renderedWidth = containerWidth;
          renderedHeight = containerWidth / imgRatio;
          offsetX = 0;
          offsetY = (containerHeight - renderedHeight) / 2;
      } else {
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * imgRatio;
          offsetX = (containerWidth - renderedWidth) / 2;
          offsetY = 0;
      }
      
      setImageGeom({ naturalWidth, naturalHeight, renderedWidth, renderedHeight, offsetX, offsetY });

      // Sync mask canvas size
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas && (maskCanvas.width !== naturalWidth || maskCanvas.height !== naturalHeight)) {
          maskCanvas.width = naturalWidth;
          maskCanvas.height = naturalHeight;
          if (maskDataUrl) {
              const maskImg = new Image();
              maskImg.onload = () => {
                  maskCanvas.getContext('2d')?.drawImage(maskImg, 0, 0);
              }
              maskImg.src = maskDataUrl;
          }
      }

  }, [maskDataUrl]);

  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas && imageGeom.naturalWidth > 0) {
        const ctx = maskCanvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            if (maskDataUrl) {
                const maskImg = new Image();
                maskImg.onload = () => {
                    ctx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
                };
                maskImg.src = maskDataUrl;
            }
        }
    }
}, [maskDataUrl, imageGeom.naturalWidth]);

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const resizeObserver = new ResizeObserver(() => {
        calculateImageGeometry();
        fitToView();
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
  }, [calculateImageGeometry, fitToView]);
  
  const getCoordsFromEvent = (e: React.MouseEvent): {x: number, y: number} | null => {
    const container = containerRef.current;
    if (!container || !imageGeom.naturalWidth) return null;

    const { naturalWidth, naturalHeight, renderedWidth, renderedHeight, offsetX, offsetY } = imageGeom;

    const rect = container.getBoundingClientRect();
    const containerX = e.clientX - rect.left;
    const containerY = e.clientY - rect.top;
    
    const unscaledX = (containerX - transform.x) / transform.scale;
    const unscaledY = (containerY - transform.y) / transform.scale;
    
    const imageRelativeX = unscaledX - offsetX;
    const imageRelativeY = unscaledY - offsetY;

    const x = Math.round(imageRelativeX * (naturalWidth / renderedWidth));
    const y = Math.round(imageRelativeY * (naturalHeight / renderedHeight));
    
    return { x, y };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current || activeTool === 'crop' || editorMode === 'masking') return;

    const { deltaY } = e;
    const scaleAmount = -deltaY / 500;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * (1 + scaleAmount)));
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - ((mouseX - transform.x) / transform.scale) * newScale;
    const newY = mouseY - ((mouseY - transform.y) / transform.scale) * newScale;
    
    setTransform({ scale: newScale, x: newX, y: newY });
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (editorMode === 'masking') {
        const coords = getCoordsFromEvent(e);
        if (coords) {
            setIsDrawing(true);
            const ctx = maskCanvasRef.current?.getContext('2d');
            if (!ctx) return;
            
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
            drawingContext.current = { lastX: coords.x, lastY: coords.y };
        }
        return;
    }

    if ((isSpacePressed || e.button === 1) && activeTool !== 'crop') { // Spacebar or Middle mouse button
        e.preventDefault();
        panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
        setIsPanning(true);
        ignoreClick.current = true;
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (editorMode === 'masking') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
    }
      
    if (isDrawing && editorMode === 'masking') {
        const coords = getCoordsFromEvent(e);
        const ctx = maskCanvasRef.current?.getContext('2d');
        if (coords && ctx && drawingContext.current) {
            ctx.lineTo(coords.x, coords.y);
            ctx.lineWidth = brushSize * (imageGeom.naturalWidth / imageGeom.renderedWidth);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
            ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
            ctx.stroke();
            drawingContext.current = { lastX: coords.x, lastY: coords.y };
        }
        return;
    }

    if (isPanning) {
        const newX = e.clientX - panStart.current.x;
        const newY = e.clientY - panStart.current.y;
        setTransform({ ...transform, x: newX, y: newY });
    }
  };
  
  const handleMouseUp = () => {
    if (isDrawing && editorMode === 'masking') {
        const canvas = maskCanvasRef.current;
        if(canvas) {
          onMaskChange(canvas.toDataURL());
        }
        setIsDrawing(false);
        drawingContext.current = null;
        return;
    }
    if (isPanning) {
      setIsPanning(false);
      setTimeout(() => { ignoreClick.current = false; }, 0);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ignoreClick.current || isSpacePressed || isPanning || !imgRef.current || activeTool === 'crop' || editorMode === 'masking') {
        return;
    }
    
    const coords = getCoordsFromEvent(e);
    if (!coords) return;
    
    const { naturalWidth, naturalHeight } = imageGeom;
    if (coords.x < 0 || coords.x > naturalWidth || coords.y < 0 || coords.y > naturalHeight) {
      return;
    }
    onHotspotClick(coords);
  };

  const adjustZoom = (amount: number) => {
    if (activeTool === 'crop' || editorMode === 'masking') return;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale + amount));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setTransform({ ...transform, scale: newScale });
      return;
    }
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newX = centerX - ((centerX - transform.x) / transform.scale) * newScale;
    const newY = centerY - ((centerY - transform.y) / transform.scale) * newScale;
    setTransform({ scale: newScale, x: newX, y: newY });
  };

  const handleMouseEnter = () => {
    if (editorMode === 'masking') {
        setIsCursorVisible(true);
    }
  };

  const handleMouseLeave = () => {
      setIsCursorVisible(false);
      // Also stop drawing if mouse leaves while pressed
      if (isDrawing) {
          handleMouseUp();
      }
  };

  if (!imageSrc) return null;
  
  let cursorClass = 'cursor-default';
  if (editorMode === 'masking') {
      cursorClass = 'cursor-none'; // Custom cursor will be shown
  } else if (isSpacePressed || isPanning) {
      cursorClass = isPanning ? 'cursor-grabbing' : 'cursor-grab';
  } else if (activeTool === 'crop') {
      cursorClass = 'cursor-default';
  } else if (['enhance', 'addObject'].includes(activeTool!)) {
      cursorClass = 'cursor-crosshair';
  } else {
      cursorClass = 'cursor-grab';
  }

  const imageContent = (
    <img
        ref={imgRef}
        src={imageSrc}
        alt="Your content"
        className="h-full w-full object-contain pointer-events-none"
        onLoad={calculateImageGeometry}
        draggable="false"
        style={{ imageRendering: 'pixelated' }}
    />
  );

  return (
    <div className="w-full h-full flex justify-center items-center p-4 relative bg-black/20 rounded-lg shadow-inner">
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden select-none"
          onWheel={handleWheel}
          onClick={handleContainerClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={handleMouseEnter}
        >
            <div
                className={`relative w-full h-full ${cursorClass}`}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: 'top left',
                }}
            >
                {activeTool === 'crop' ? (
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => onCropChange(percentCrop)}
                        onComplete={(c) => onCropComplete(c)}
                        aspect={aspect}
                        className="flex justify-center items-center"
                    >
                        {imageContent}
                    </ReactCrop>
                ) : imageContent}

                {/* Mask Overlay */}
                {maskDataUrl && editorMode === 'normal' && (
                    <div 
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{
                        maskImage: `url(${maskDataUrl})`,
                        WebkitMaskImage: `url(${maskDataUrl})`,
                        maskSize: '100% 100%',
                        WebkitMaskSize: '100% 100%',
                        backgroundColor: 'rgba(239, 68, 68, 0.5)', // red-500 with 50% opacity
                      }}
                    />
                )}

                {/* Mask Drawing Canvas */}
                <canvas 
                    ref={maskCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50"
                    style={{ 
                        imageRendering: 'pixelated',
                        display: editorMode === 'masking' ? 'block' : 'none',
                        mixBlendMode: 'screen'
                    }} 
                />
                
                {editHotspot && (activeTool === 'enhance' || activeTool === 'addObject') && imageGeom.renderedWidth > 0 && (() => {
                    const { renderedWidth, offsetX, offsetY } = imageGeom;
                    if (imageGeom.naturalWidth === 0) return null;

                    const scale = renderedWidth / imageGeom.naturalWidth;
                    const left = offsetX + editHotspot.x * scale;
                    const top = offsetY + editHotspot.y * scale;
                    
                    return (
                      <div
                        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500/50 pointer-events-none ring-2 ring-blue-500 animate-ping-once"
                        style={{ left: `${left}px`, top: `${top}px` }}
                      />
                    );
                })()}
            </div>
        </div>

        {/* Brush Cursor */}
        {editorMode === 'masking' && isCursorVisible && (
            <div
                className={`absolute rounded-full pointer-events-none transition-transform duration-100 ${isDrawing ? 'scale-90 bg-white/30' : 'bg-transparent'}`}
                style={{
                    left: `${cursorPos.x}px`,
                    top: `${cursorPos.y}px`,
                    width: `${brushSize}px`,
                    height: `${brushSize}px`,
                    border: '2px solid white',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
                    mixBlendMode: 'difference',
                }}
            />
        )}
        
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-gray-800/70 p-1.5 rounded-lg backdrop-blur-sm text-sm">
            <Tooltip text="Zoom Out (Ctrl/Cmd + -)">
              <button onClick={() => adjustZoom(-0.2)} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" disabled={activeTool === 'crop' || editorMode === 'masking'}><MagnifyingGlassMinusIcon className="w-5 h-5" /></button>
            </Tooltip>
            <span className="text-gray-200 font-mono w-16 text-center tabular-nums">
                {(transform.scale * 100).toFixed(0)}%
            </span>
            <Tooltip text="Zoom In (Ctrl/Cmd + +)">
              <button onClick={() => adjustZoom(0.2)} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" disabled={activeTool === 'crop' || editorMode === 'masking'}><MagnifyingGlassPlusIcon className="w-5 h-5" /></button>
            </Tooltip>
            <Tooltip text="Fit to View (Ctrl/Cmd + 0)">
              <button onClick={fitToView} className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" disabled={activeTool === 'crop' || editorMode === 'masking'}><ArrowsPointingOutIcon className="w-5 h-5" /></button>
            </Tooltip>
        </div>
    </div>
  );
});

export default EditorCanvas;
