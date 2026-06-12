import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const COMPLETE_RATIO = 0.88;

type GroobeySlideToOrderProps = {
  to?: string;
  label?: string;
};

export function GroobeySlideToOrder({
  to = "/shop",
  label = "Slide to start your order",
}: GroobeySlideToOrderProps) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({ startX: 0, startOffset: 0 });
  const completedRef = useRef(false);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [maxOffset, setMaxOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);

  const measureMaxOffset = useCallback(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return 0;

    const styles = getComputedStyle(track);
    const padLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const padRight = Number.parseFloat(styles.paddingRight) || 0;
    return Math.max(0, track.clientWidth - thumb.offsetWidth - padLeft - padRight);
  }, []);

  useEffect(() => {
    function update() {
      setMaxOffset(measureMaxOffset());
    }

    update();
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(update);
    observer.observe(track);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [measureMaxOffset]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  function setSlideOffset(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
    setDragging(false);
    setSlideOffset(measureMaxOffset());
    window.setTimeout(() => {
      void navigate({ to });
    }, 220);
  }, [measureMaxOffset, navigate, to]);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (completed) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startOffset: offsetRef.current };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging || completed) return;

    const max = measureMaxOffset();
    const delta = event.clientX - dragRef.current.startX;
    const next = Math.max(0, Math.min(max, dragRef.current.startOffset + delta));
    setSlideOffset(next);
  }

  function onPointerEnd() {
    if (completedRef.current) return;
    setDragging(false);

    const max = measureMaxOffset();
    const current = offsetRef.current;
    if (max > 0 && current >= max * COMPLETE_RATIO) {
      setSlideOffset(max);
      finish();
      return;
    }

    setSlideOffset(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (completed) return;

    const max = measureMaxOffset();
    const step = Math.max(14, max * 0.14);

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSlideOffset(Math.min(max, offsetRef.current + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSlideOffset(Math.max(0, offsetRef.current - step));
    } else if (event.key === "Enter" || event.key === " ") {
      if (max > 0 && offsetRef.current >= max * COMPLETE_RATIO) {
        event.preventDefault();
        setSlideOffset(max);
        finish();
      }
    }
  }

  const progress = maxOffset > 0 ? offset / maxOffset : 0;
  const atThreshold = maxOffset > 0 && offset >= maxOffset * COMPLETE_RATIO;
  const hintOpacity = Math.max(0, 1 - progress * 1.35);
  const hintText = atThreshold ? "Release to order" : label;

  return (
    <div
      ref={trackRef}
      className={[
        "groobey-slide-order",
        dragging ? "groobey-slide-order--dragging" : "",
        atThreshold ? "groobey-slide-order--ready" : "",
        completed ? "groobey-slide-order--complete" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="groobey-slide-order-fill"
        style={{ width: `calc(${offset}px + 2.15rem)` }}
        aria-hidden
      />
      <span
        className="groobey-slide-order-hint"
        style={{ opacity: atThreshold ? 1 : hintOpacity }}
        aria-hidden
      >
        {hintText}
        {!atThreshold ?
          <span className="groobey-slide-order-hint-arrows">››</span>
        : null}
      </span>
      <button
        ref={thumbRef}
        type="button"
        className="groobey-slide-order-thumb"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        role="slider"
        disabled={completed}
      >
        {completed ?
          <Check className="groobey-slide-order-thumb-icon" strokeWidth={2.5} aria-hidden />
        : <ArrowRight className="groobey-slide-order-thumb-icon" strokeWidth={2.5} aria-hidden />}
      </button>
    </div>
  );
}
