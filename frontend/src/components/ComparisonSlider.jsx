import { useState, useRef, useCallback } from "react";
import { getImageUrl } from "../utils";

export default function ComparisonSlider({ targetUrl, submissionUrl }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    e.target.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      className="comparison-slider"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        src={getImageUrl(submissionUrl)}
        alt="Submission"
        className="comparison-img comparison-img-bottom"
        draggable={false}
      />
      <img
        src={getImageUrl(targetUrl)}
        alt="Target"
        className="comparison-img comparison-img-top"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
      />
      <div className="comparison-divider" style={{ left: `${position}%` }}>
        <div className="comparison-handle" />
      </div>
      <span className="comparison-label comparison-label-left">Target</span>
      <span className="comparison-label comparison-label-right">Submission</span>
    </div>
  );
}
