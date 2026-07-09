import { useEffect, useRef } from "react";

const COLORS = ["#00e5ff", "#7c4dff", "#00ffd8", "#ff6b6b", "#ffd700", "#ff69b4", "#00ff88"];
const PARTICLE_COUNT = 120;

export default function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: 4 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let animFrame;
    let startTime = Date.now();
    const DURATION = 4000;

    function draw() {
      const elapsed = Date.now() - startTime;
      if (elapsed > DURATION) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fadeFactor = elapsed > DURATION * 0.6 ? 1 - (elapsed - DURATION * 0.6) / (DURATION * 0.4) : 1;

      particles.forEach((p) => {
        p.x += p.vx;
        p.vy += 0.05;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = fadeFactor;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      animFrame = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrame);
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}
