import { useEffect, useRef, useState, useCallback } from "react";

export const ITEMS = [
  {
    id: "tray-vision",
    label: "Tray Vision",
    img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80",
    desc: "AI plate auditing",
    color: "#60a5fa",
  },
  {
    id: "drug-food",
    label: "Drug-Food",
    img: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=400&q=80",
    desc: "Conflict detection",
    color: "#a78bfa",
  },
  {
    id: "compliance",
    label: "Compliance",
    img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80",
    desc: "Predictive AI",
    color: "#34d399",
  },
  {
    id: "rag-pqc",
    label: "RAG + PQC",
    img: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80",
    desc: "Signed citations",
    color: "#818cf8",
  },
];

const N       = ITEMS.length;  // 4
const R       = 148;           // orbit radius px
const SIZE    = 430;           // container size
const CX      = 215;           // horizontal centre
const CY      = 238;           // shifted down so top item has room
const MAIN_D  = 168;           // active image size  (3 × SM_D)
const SM_D    = 56;            // secondary image size
const SPD     = 0.013;         // deg per ms (~13 deg/sec)
const FRONT   = 270;           // deg on circle = front (top, 12 o'clock)

export default function CarouselOrbit({ activeId, onItemClick, autoRotate = true }) {
  const [offset, setOffset]   = useState(0);
  const rafRef                = useRef(null);
  const pausedRef             = useRef(false);
  const snapTargetRef         = useRef(null);

  // Index whose orbit angle is closest to FRONT
  const getFrontIndex = (off) => {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < N; i++) {
      const deg  = ((off + (i * 360) / N) % 360 + 360) % 360;
      const dist = Math.min(Math.abs(deg - FRONT), 360 - Math.abs(deg - FRONT));
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  };

  // Snap so item[idx] lands at FRONT
  const snapToIndex = useCallback((idx, currentOffset) => {
    const needed = ((FRONT - (idx * 360) / N) % 360 + 360) % 360;
    const cur    = ((currentOffset % 360) + 360) % 360;
    let delta = needed - cur;
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;
    snapTargetRef.current = currentOffset + delta;
  }, []);

  // Respond to activeId prop
  useEffect(() => {
    if (!activeId) return;
    const idx = ITEMS.findIndex(it => it.id === activeId);
    if (idx < 0) return;
    // Need current offset — read from state via functional setter trick
    setOffset(prev => {
      snapToIndex(idx, prev);
      return prev; // don't change yet, RAF will ease toward snapTarget
    });
  }, [activeId, snapToIndex]);

  // RAF loop
  useEffect(() => {
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      setOffset(prev => {
        if (snapTargetRef.current !== null) {
          const remaining = snapTargetRef.current - prev;
          if (Math.abs(remaining) < 0.3) {
            const done = snapTargetRef.current;
            snapTargetRef.current = null;
            return done;
          }
          return prev + remaining * Math.min(dt * 0.01, 0.85);
        }
        if (autoRotate && !pausedRef.current) {
          return prev + dt * SPD;
        }
        return prev;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoRotate]);

  const frontIdx = getFrontIndex(offset);

  return (
    <div style={{
      position: "relative",
      width: SIZE,
      height: SIZE,
      userSelect: "none",
      flexShrink: 0,
    }}>
      {ITEMS.map((item, i) => {
        const deg    = ((offset + (i * 360) / N) % 360 + 360) % 360;
        const rad    = (deg * Math.PI) / 180;
        const x      = CX + R * Math.cos(rad);
        const y      = CY + R * Math.sin(rad);
        const isMain = (i === frontIdx);
        const d      = isMain ? MAIN_D : SM_D;

        return (
          <div
            key={item.id}
            onClick={() => {
              setOffset(prev => { snapToIndex(i, prev); return prev; });
              onItemClick?.(item.id);
            }}
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            style={{
              position: "absolute",
              left:    x - d / 2,
              top:     y - d / 2,
              width:   d,
              height:  d,
              zIndex:  isMain ? 10 : 3,
              opacity: isMain ? 1 : 0.42,
              cursor:  "pointer",
              transition: "opacity 0.38s ease",
              // position transitions: let geometry drive position naturally via RAF
            }}
          >
            {/* Square image */}
            <div style={{
              width:  "100%",
              height: "100%",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: isMain
                ? `0 0 40px ${item.color}55, 0 8px 28px rgba(0,0,0,0.12)`
                : "0 2px 10px rgba(0,0,0,0.09)",
              transition: "box-shadow 0.38s ease",
            }}>
              <img
                src={item.img}
                alt={item.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: isMain ? "none" : "grayscale(20%) brightness(0.78)",
                  transition: "filter 0.38s ease",
                }}
              />
            </div>

            {/* Label only under main image */}
            {isMain && (
              <div style={{
                position: "absolute",
                bottom: -28,
                left: "50%",
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 2.5,
                  color: item.color,
                  fontFamily: "'DM Mono', monospace",
                  textTransform: "uppercase",
                }}>
                  {item.label}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

