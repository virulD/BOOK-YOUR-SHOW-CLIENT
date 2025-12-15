'use client';

import { useEffect, useRef } from 'react';
import Konva from 'konva';

interface Seat {
  _id?: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  basePrice?: number;
  seatType?: string;
  state?: string;
  section?: string;
  row?: string;
  number?: number;
}

interface SeatCanvasProps {
  seats: Seat[];
  selectedSeats: Set<string>;
  backgroundImage: HTMLImageElement | null;
  stageSize: { width: number; height: number };
  onStageClick: (e: any) => void;
  onSeatClick: (seatId: string, e: any) => void;
  onSeatDragEnd: (index: number, newX: number, newY: number) => void;
  stageRef: React.RefObject<any>;
}

export default function SeatCanvas({
  seats,
  selectedSeats,
  backgroundImage,
  stageSize,
  onStageClick,
  onSeatClick,
  onSeatDragEnd,
  stageRef,
}: SeatCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const konvaStageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const seatShapesRef = useRef<Map<string, Konva.Rect>>(new Map());
  const seatTextsRef = useRef<Map<string, Konva.Text>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Konva stage
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: stageSize.width,
      height: stageSize.height,
    });

    konvaStageRef.current = stage;
    if (stageRef) {
      (stageRef as any).current = stage;
    }

    // Create layer
    const layer = new Konva.Layer();
    stage.add(layer);
    layerRef.current = layer;

    // Add background image if available
    if (backgroundImage) {
      const bgImage = new Konva.Image({
        x: 0,
        y: 0,
        image: backgroundImage,
        width: stageSize.width,
        height: stageSize.height,
      });
      layer.add(bgImage);
    }

    // Handle stage click
    stage.on('click', (e) => {
      if (e.target === stage) {
        onStageClick(e);
      }
    });

    // Cleanup
    return () => {
      stage.destroy();
    };
  }, [stageSize.width, stageSize.height, backgroundImage]);

  // Update seats
  useEffect(() => {
    if (!layerRef.current) return;

    const layer = layerRef.current;

    // Remove old shapes
    seatShapesRef.current.forEach((shape) => shape.destroy());
    seatTextsRef.current.forEach((text) => text.destroy());
    seatShapesRef.current.clear();
    seatTextsRef.current.clear();

    // Create new shapes
    seats.forEach((seat, index) => {
      const seatId = seat._id || `seat-${index}`;
      const isSelected = selectedSeats.has(seatId);

      // Create rectangle
      const rect = new Konva.Rect({
        x: seat.x * stageSize.width,
        y: seat.y * stageSize.height,
        width: seat.width * stageSize.width,
        height: seat.height * stageSize.height,
        fill: isSelected ? 'rgba(99, 102, 241, 0.6)' : 'rgba(16, 185, 129, 0.4)',
        stroke: isSelected ? '#6366f1' : '#10b981',
        strokeWidth: 2,
        draggable: true,
      });

      rect.on('click', (e) => {
        e.cancelBubble = true;
        onSeatClick(seatId, e);
      });

      rect.on('dragmove', () => {
        // Update text position while dragging for smooth movement
        const text = seatTextsRef.current.get(seatId);
        if (text) {
          text.x(rect.x());
          text.y(rect.y() - 15);
          layer.draw();
        }
      });

      rect.on('dragend', () => {
        const newX = rect.x() / stageSize.width;
        const newY = rect.y() / stageSize.height;
        onSeatDragEnd(index, newX, newY);
      });

      layer.add(rect);
      seatShapesRef.current.set(seatId, rect);

      // Create text label
      const text = new Konva.Text({
        x: seat.x * stageSize.width,
        y: seat.y * stageSize.height - 15,
        text: seat.label,
        fontSize: 12,
        fill: 'black',
      });

      layer.add(text);
      seatTextsRef.current.set(seatId, text);
    });

    layer.draw();
  }, [seats, selectedSeats, stageSize.width, stageSize.height, onSeatClick, onSeatDragEnd]);

  return (
    <div
      ref={containerRef}
      style={{
        width: stageSize.width,
        height: stageSize.height,
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
      }}
    />
  );
}
