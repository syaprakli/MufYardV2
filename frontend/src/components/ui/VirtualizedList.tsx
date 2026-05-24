import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type VirtualizedListProps<T> = {
    items: T[];
    itemKey: (item: T, index: number) => string;
    renderItem: (item: T, index: number) => ReactNode;
    estimatedItemHeight: number;
    overscan?: number;
    minCountToVirtualize?: number;
    className?: string;
    itemClassName?: string;
    emptyState?: ReactNode;
};

export function VirtualizedList<T>({
    items,
    itemKey,
    renderItem,
    estimatedItemHeight,
    overscan = 4,
    minCountToVirtualize = 20,
    className,
    itemClassName,
    emptyState
}: VirtualizedListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateHeight = () => setViewportHeight(element.clientHeight);
        updateHeight();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateHeight);
            return () => window.removeEventListener("resize", updateHeight);
        }

        const observer = new ResizeObserver(updateHeight);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const shouldVirtualize = items.length >= minCountToVirtualize && viewportHeight > 0;

    const { startIndex, endIndex, totalHeight } = useMemo(() => {
        if (!shouldVirtualize) {
            return {
                startIndex: 0,
                endIndex: items.length,
                totalHeight: items.length * estimatedItemHeight
            };
        }

        const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight);
        const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - overscan);
        const end = Math.min(items.length, start + visibleCount + overscan * 2);

        return {
            startIndex: start,
            endIndex: end,
            totalHeight: items.length * estimatedItemHeight
        };
    }, [estimatedItemHeight, items.length, overscan, scrollTop, shouldVirtualize, viewportHeight]);

    if (items.length === 0) {
        return <>{emptyState || null}</>;
    }

    const visibleItems = shouldVirtualize ? items.slice(startIndex, endIndex) : items;
    const offsetY = shouldVirtualize ? startIndex * estimatedItemHeight : 0;

    return (
        <div ref={containerRef} className={className} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
            {shouldVirtualize ? (
                <div style={{ position: "relative", height: totalHeight }}>
                    <div style={{ transform: `translateY(${offsetY}px)` }} className={itemClassName}>
                        {visibleItems.map((item, index) => {
                            const actualIndex = shouldVirtualize ? startIndex + index : index;
                            return (
                                <div key={itemKey(item, actualIndex)}>
                                    {renderItem(item, actualIndex)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className={itemClassName}>
                    {visibleItems.map((item, index) => (
                        <div key={itemKey(item, index)}>
                            {renderItem(item, index)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
