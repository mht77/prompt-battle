import { useState, useCallback, useRef, useEffect } from "react";

export default function FloatingEmojis({ emojis }) {
  const [completed, setCompleted] = useState(new Set());
  const positionsRef = useRef({});

  useEffect(() => {
    if (emojis.length === 0) {
      setCompleted(new Set());
      positionsRef.current = {};
    }
  }, [emojis]);

  const handleAnimationEnd = useCallback((id) => {
    setCompleted((prev) => new Set(prev).add(id));
  }, []);

  const visible = emojis.filter((e) => !completed.has(e.id));

  return (
    <div className="floating-emojis-container">
      {visible.map((item) => {
        if (!(item.id in positionsRef.current)) {
          positionsRef.current[item.id] = 10 + Math.random() * 80;
        }
        return (
          <span
            key={item.id}
            className="floating-emoji"
            style={{ left: `${positionsRef.current[item.id]}%` }}
            onAnimationEnd={() => handleAnimationEnd(item.id)}
          >
            {item.emoji}
          </span>
        );
      })}
    </div>
  );
}
