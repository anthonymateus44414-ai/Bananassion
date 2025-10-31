/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Stage, Layer as KonvaLayer, Image as KonvaImage, Rect, Transformer, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import { Layer, Hotspot, Tool, BrushShape, DetectedObject } from '../types';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import ZoomControls from './ZoomControls.tsx';


interface EditorCanvasProps {
    baseImage: File;
    layers: Layer[];
    isMasking: boolean;
    maskDataUrl: string | null;
    onMaskChange: (dataUrl: string | null) => void;
    onHotspot: (hotspot: Hotspot | null) => void;
    editHotspot: Hotspot | null;
    activeTool: Tool;
    stageState: { scale: number; x: number; y: number };
    onStageStateChange: (newState: { scale: number; x: number; y: number }) => void;
    brushSize: number;
    brushShape: BrushShape;
    brushHardness: number;
    maskPreviewOpacity: number;
    detectedObjects: DetectedObject[] | null;
    selectedObjectMasks: string[];
    onObjectMaskToggle: (maskUrl: string) => void;
    selectedLayerId: string | null;
    onSelectLayer: (layerId: string | null) => void;
    onUpdateLayerTransform: (layerId: string, newTransform: Layer['transform']) => void;
    onInspectElement: (point: { x: number; y: number }) => void;
    inspectedElementMask: string | null;
}

const TransformableImage: React.FC<{
    layer: Layer;
    isSelected: boolean;
    onSelect: () => void;
    onTransform: (newAttrs: any) => void;
    onDragEnd: (newAttrs: any) => void;
}> = ({ layer, isSelected, onSelect, onTransform, onDragEnd }) => {
    const shapeRef = useRef<Konva.Image>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const [image] = useImage(layer.params.imageDataUrl);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);
    
    if (!layer.transform) return null;

    return (
        <React.Fragment>
            <KonvaImage
                ref={shapeRef}
                image={image}
                onClick={onSelect}
                onTap={onSelect}
                draggable
                x={layer.transform.x}
                y={layer.transform.y}
                width={layer.transform.width}
                height={layer.transform.height}
                rotation={layer.transform.rotation}
                onDragEnd={(e) => {
                    onDragEnd({
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = shapeRef.current;
                    if (node) {
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        onTransform({
                            x: node.x(),
                            y: node.y(),
                            width: Math.max(5, node.width() * scaleX),
                            height: Math.max(5, node.height() * scaleY),
                            rotation: node.rotation(),
                        });
                    }
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    anchorStroke="#3B82F6"
                    anchorFill="white"
                    anchorSize={10}
                    borderStroke="#3B82F6"
                    borderStrokeWidth={2}
                    boundBoxFunc={(oldBox, newBox) => {
                        // limit resize
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </React.Fragment>
    );
};

const EditorCanvas = React.forwardRef<Konva.Stage, EditorCanvasProps>(({
    baseImage,
    layers,
    isMasking,
    maskDataUrl,
    onMaskChange,
    onHotspot,
    editHotspot,
    activeTool,
    stageState,
    onStageStateChange,
    brushSize,
    brushShape,
    brushHardness,
    maskPreviewOpacity,
    detectedObjects,
    selectedObjectMasks,
    onObjectMaskToggle,
    selectedLayerId,
    onSelectLayer,
    onUpdateLayerTransform,
    onInspectElement,
    inspectedElementMask,
}, stageRef) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    const baseImageUrl = useMemo(() => URL.createObjectURL(baseImage), [baseImage]);
    
    // This is the new rendering logic.
    // It finds the last generative layer's output as the base,
    // and then collects all subsequent image layers to be rendered on top.
    const { finalGenerativeSrc, imageLayers } = useMemo(() => {
        const generativeLayers = layers.filter(l => l.tool !== 'image');
        const lastVisibleGenerativeLayer = generativeLayers
            .filter(l => l.isVisible && l.cachedResult)
            .slice(-1)[0];

        const src = lastVisibleGenerativeLayer?.cachedResult || baseImageUrl;
        
        // Image layers are composited on top of the final generative result.
        const imgLayers = layers.filter(l => l.tool === 'image' && l.isVisible);
        
        return { finalGenerativeSrc: src, imageLayers: imgLayers };
    }, [layers, baseImageUrl]);
    
    
    const [displayedImg, , ] = useImage(finalGenerativeSrc);
    const [displayedImageSize, setDisplayedImageSize] = useState({ width: 0, height: 0 });

    const maskLayerRef = useRef<Konva.Layer>(null);
    const isDrawing = useRef(false);
    const currentLine = useRef<Konva.Line | null>(null);

    
    const [objectImages, setObjectImages] = useState<{ [key: string]: HTMLImageElement }>({});
    
    const [initialMaskImage, setInitialMaskImage] = useState<HTMLImageElement | null>(null);
    const [maskImgFromUrl] = useImage(maskDataUrl || '');
    const [inspectedMaskImage] = useImage(inspectedElementMask || '');

    const hotspotRef = useRef<Konva.Circle>(null);
    
    const imageRef = useRef<Konva.Image>(null);
    
    // Update displayed image size when the source changes (e.g., after a crop)
    useEffect(() => {
        if (displayedImg) {
            setDisplayedImageSize({ width: displayedImg.width, height: displayedImg.height });
        }
    }, [displayedImg]);

    // Preload object mask images
    useEffect(() => {
        if (detectedObjects) {
            const newObjectImages: { [key: string]: HTMLImageElement } = {};
            let loadedCount = 0;
            if (detectedObjects.length === 0) {
                 setObjectImages({});
                 return;
            }
            detectedObjects.forEach(obj => {
                const img = new Image();
                img.src = obj.mask;
                img.onload = () => {
                    newObjectImages[obj.mask] = img;
                    loadedCount++;
                    if (loadedCount === detectedObjects.length) {
                        setObjectImages(newObjectImages);
                    }
                };
            });
        } else {
            setObjectImages({});
        }
    }, [detectedObjects]);
    
    const objectSelectionColors = useMemo(() => [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'
    ], []);

    // Fit image to container. This now runs whenever the displayed image size changes.
    useEffect(() => {
        const checkSize = () => {
            if (containerRef.current && displayedImg && displayedImageSize.width > 0) {
                const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
                setDimensions({ width: containerWidth, height: containerHeight });

                const scaleX = containerWidth / displayedImageSize.width;
                const scaleY = containerHeight / displayedImageSize.height;
                const initialScale = Math.min(scaleX, scaleY, 1);
                
                onStageStateChange({
                    scale: initialScale,
                    x: (containerWidth - displayedImageSize.width * initialScale) / 2,
                    y: (containerHeight - displayedImageSize.height * initialScale) / 2,
                });
            }
        };
        checkSize();
        window.addEventListener('resize', checkSize);
        return () => {
            window.removeEventListener('resize', checkSize);
            if (baseImageUrl) URL.revokeObjectURL(baseImageUrl);
        };
    }, [displayedImg, displayedImageSize, onStageStateChange, baseImageUrl]);
    
    const handleZoom = useCallback((direction: 'in' | 'out') => {
        const stage = (stageRef as React.RefObject<Konva.Stage>).current;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const center = {
            x: dimensions.width / 2,
            y: dimensions.height / 2,
        };

        const mousePointTo = {
            x: (center.x - stage.x()) / oldScale,
            y: (center.y - stage.y()) / oldScale,
        };
        
        const scaleBy = 1.2;
        const newScale = direction === 'in' ? oldScale * scaleBy : oldScale / scaleBy;

        onStageStateChange({
            scale: newScale,
            x: center.x - mousePointTo.x * newScale,
            y: center.y - mousePointTo.y * newScale,
        });
    }, [dimensions.width, dimensions.height, onStageStateChange, stageRef]);

    const handleResetZoom = useCallback(() => {
        if (containerRef.current && displayedImg && displayedImageSize.width > 0) {
            const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();

            const scaleX = containerWidth / containerWidth;
            const scaleY = containerHeight / displayedImageSize.height;
            const initialScale = Math.min(scaleX, scaleY, 1);
            
            onStageStateChange({
                scale: initialScale,
                x: (containerWidth - displayedImageSize.width * initialScale) / 2,
                y: (containerHeight - displayedImageSize.height * initialScale) / 2,
            });
        }
    }, [displayedImg, displayedImageSize.width, displayedImageSize.height, onStageStateChange]);

    // Initialize or clear the mask when masking mode changes.
    useEffect(() => {
        const maskLayer = maskLayerRef.current;
        if (!maskLayer) return;

        maskLayer.destroyChildren();

        if (isMasking) {
            if (maskDataUrl && maskImgFromUrl) {
                setInitialMaskImage(maskImgFromUrl);
                 maskLayer.add(new Konva.Image({
                    image: maskImgFromUrl,
                    width: displayedImageSize.width,
                    height: displayedImageSize.height,
                    globalCompositeOperation: 'source-over',
                }));
            } else {
                setInitialMaskImage(null);
            }
        } else {
            setInitialMaskImage(null);
        }
        maskLayer.draw();

    }, [isMasking, maskDataUrl, maskImgFromUrl, displayedImageSize]);
    
    // Animate the hotspot marker with a pulsing effect
    useEffect(() => {
        if (editHotspot && hotspotRef.current) {
            const anim = new Konva.Animation(frame => {
                if (!frame) return;
                const scale = 1 + Math.sin(frame.time / 200) * 0.2; // pulse effect
                hotspotRef.current?.scaleX(scale);
                hotspotRef.current?.scaleY(scale);
            }, hotspotRef.current.getLayer());

            anim.start();
            // FIX: The useEffect cleanup function must return void. anim.stop() returns the animation instance.
            return () => {
                anim.stop();
            };
        }
    }, [editHotspot]);


    const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
        // Deselect if clicking on the background
        const didClickOnEmpty = e.target === e.target.getStage();
        if (didClickOnEmpty) {
            onSelectLayer(null);
        }

        if (!isMasking) return;
        isDrawing.current = true;
        const stage = e.target.getStage();
        const maskLayer = maskLayerRef.current;
        if (!stage || !maskLayer) return;

        const transform = stage.getAbsoluteTransform().copy().invert();
        const pos = stage.getPointerPosition();
        if (!pos) return;
        
        const relativePos = transform.point(pos);

        const isSoftBrush = brushShape === 'circle';
        const shadowBlur = isSoftBrush ? (1 - brushHardness) * brushSize * 0.7 : 0;

        // Create Konva line directly, don't update React state for performance
        const newLine = new Konva.Line({
            stroke: '#FFFFFF',
            strokeWidth: brushSize,
            globalCompositeOperation: brushShape === 'circle' ? 'source-over' : 'destination-out',
            lineCap: 'round',
            lineJoin: 'round',
            tension: 0.5,
            points: [relativePos.x, relativePos.y],
            // Soft brush effect
            shadowColor: '#FFFFFF',
            shadowBlur: shadowBlur,
            shadowEnabled: isSoftBrush,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
        });
        
        maskLayer.add(newLine);
        currentLine.current = newLine;
    };
    
    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing.current || !isMasking || !currentLine.current) return;
        
        const stage = e.target.getStage();
        if (!stage) return;
    
        const transform = stage.getAbsoluteTransform().copy().invert();
        const point = stage.getPointerPosition();
        if (!point) return;
    
        const relativePos = transform.point(point);
    
        // Update Konva line directly, bypassing React state
        const newPoints = currentLine.current.points().concat([relativePos.x, relativePos.y]);
        currentLine.current.points(newPoints);
        
        maskLayerRef.current?.batchDraw();
    };
    
    const handleMouseUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        currentLine.current = null;
    
        if (isMasking && maskLayerRef.current && displayedImageSize.width > 0) {
            // Clone the visible layer to create a temporary, untransformed version for export.
            // This prevents the stage's pan/zoom from affecting the captured image.
            const exportLayer = maskLayerRef.current.clone();
            exportLayer.opacity(1); // Ensure full opacity for the mask capture.
    
            const transparentMaskCanvas = exportLayer.toCanvas({
                x: 0,
                y: 0,
                width: displayedImageSize.width,
                height: displayedImageSize.height,
                pixelRatio: 1 // Explicitly set to 1 to avoid high-DPI scaling issues.
            });
    
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = displayedImageSize.width;
            finalCanvas.height = displayedImageSize.height;
            const ctx = finalCanvas.getContext('2d');
    
            if (!ctx || !transparentMaskCanvas) {
                console.error("Failed to create canvas or context for mask generation.");
                onMaskChange(null);
                return;
            }
    
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            ctx.drawImage(transparentMaskCanvas, 0, 0);
    
            const finalMaskDataUrl = finalCanvas.toDataURL();
            onMaskChange(finalMaskDataUrl);
    
        } else if (isMasking) {
            onMaskChange(null);
        }
    };

    const handleImageClick = (e: KonvaEventObject<MouseEvent>) => {
        if (detectedObjects || activeTool === 'transform' || isMasking) return;
        
        const stage = e.target.getStage();
        if (!stage || !imageRef.current) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        const relativeX = (pos.x - stage.x()) / stage.scaleX();
        const relativeY = (pos.y - stage.y()) / stage.scaleY();
        
        // Ensure click is within image bounds
        if (relativeX < 0 || relativeX > displayedImageSize.width || relativeY < 0 || relativeY > displayedImageSize.height) return;

        const point = {
            x: (relativeX / displayedImageSize.width) * 100,
            y: (relativeY / displayedImageSize.height) * 100
        };

        if (['addObject', 'enhance'].includes(activeTool)) {
            onHotspot(point);
        }
    };
    
    const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;

        onStageStateChange({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    
    const cursorStyle = useMemo(() => {
        if (detectedObjects) return 'default';
        if (activeTool === 'transform') return 'default';
        if (isMasking) return 'crosshair';
        if (['addObject', 'enhance'].includes(activeTool)) return 'pointer';
        return 'grab';
    }, [isMasking, activeTool, detectedObjects]);

    const handleUpdateFullTransform = useCallback((layerId: string, newAttrs: any) => {
        const layer = layers.find(l => l.id === layerId);
        if (layer?.transform) {
            onUpdateLayerTransform(layerId, { ...layer.transform, ...newAttrs });
        }
    }, [layers, onUpdateLayerTransform]);

    return (
        <div 
            ref={containerRef} 
            className={`w-full h-full relative transition-all duration-300 ${isMasking ? 'masking-active-border' : 'border-2 border-transparent'}`}
        >
            <Stage 
                width={dimensions.width} 
                height={dimensions.height}
                ref={stageRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                scaleX={stageState.scale}
                scaleY={stageState.scale}
                x={stageState.x}
                y={stageState.y}
                draggable={!isMasking && !detectedObjects && activeTool !== 'transform'}
                onDragEnd={(e) => {
                    onStageStateChange({ ...stageState, x: e.target.x(), y: e.target.y() });
                }}
                style={{ cursor: cursorStyle }}
                onClick={(e: KonvaEventObject<MouseEvent>) => {
                    const didClickOnEmpty = e.target === e.target.getStage();
                    if (didClickOnEmpty) {
                        onSelectLayer(null);
                    }
                }}
            >
                <KonvaLayer>
                    {displayedImg && (
                        <KonvaImage
                            ref={imageRef}
                            image={displayedImg}
                            width={displayedImageSize.width}
                            height={displayedImageSize.height}
                            alt="Editable image"
                            onClick={handleImageClick}
                            onTap={handleImageClick}
                        />
                    )}

                    {imageLayers.map(layer => (
                        <TransformableImage
                            key={layer.id}
                            layer={layer}
                            isSelected={selectedLayerId === layer.id}
                            onSelect={() => {
                                if (activeTool === 'transform') {
                                    onSelectLayer(layer.id);
                                }
                            }}
                            onTransform={(newAttrs) => onUpdateLayerTransform(layer.id, newAttrs)}
                            onDragEnd={(newAttrs) => handleUpdateFullTransform(layer.id, newAttrs)}
                        />
                    ))}
                </KonvaLayer>

                <KonvaLayer
                    ref={maskLayerRef}
                    opacity={isMasking ? maskPreviewOpacity : 0}
                    listening={false}
                />

                {detectedObjects && (
                     <KonvaLayer>
                        {detectedObjects.map((obj, index) => {
                            const isSelected = selectedObjectMasks.includes(obj.mask);
                            const color = objectSelectionColors[index % objectSelectionColors.length];
                            if (objectImages[obj.mask]) {
                                return (
                                    <KonvaImage
                                        key={obj.mask}
                                        image={objectImages[obj.mask]}
                                        width={displayedImageSize.width}
                                        height={displayedImageSize.height}
                                        fill={color}
                                        opacity={isSelected ? 0.6 : 0.4}
                                        globalCompositeOperation="multiply"
                                        onClick={() => onObjectMaskToggle(obj.mask)}
                                        onTap={() => onObjectMaskToggle(obj.mask)}
                                        onMouseEnter={e => {
                                            const stage = e.target.getStage();
                                            if (stage) stage.container().style.cursor = 'pointer';
                                        }}
                                        onMouseLeave={e => {
                                             const stage = e.target.getStage();
                                            if (stage) stage.container().style.cursor = 'default';
                                        }}
                                    />
                                );
                            }
                            return null;
                        })}
                    </KonvaLayer>
                )}
                <KonvaLayer listening={false}>
                    {editHotspot && displayedImageSize.width > 0 && (
                        <Circle
                            ref={hotspotRef}
                            x={(editHotspot.x / 100) * displayedImageSize.width}
                            y={(editHotspot.y / 100) * displayedImageSize.height}
                            radius={10 / stageState.scale}
                            stroke="#3B82F6"
                            strokeWidth={2 / stageState.scale}
                            fill="#3B82F64D"
                        />
                    )}
                    {inspectedElementMask && inspectedMaskImage && (
                        <KonvaImage
                            image={inspectedMaskImage}
                            width={displayedImageSize.width}
                            height={displayedImageSize.height}
                            fill="#3B82F6"
                            opacity={0.5}
                            globalCompositeOperation="multiply"
                        />
                    )}
                </KonvaLayer>
            </Stage>
            <ZoomControls 
                scale={stageState.scale}
                onZoomIn={() => handleZoom('in')}
                onZoomOut={() => handleZoom('out')}
                onResetZoom={handleResetZoom}
            />
        </div>
    );
});

export default EditorCanvas;