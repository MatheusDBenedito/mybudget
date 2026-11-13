"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
    DASHBOARD_BLOCK_TITLES,
    clampHeightPx,
    clampWidthPct,
    widthCssPercent,
    type DashboardBlockId,
    type DashboardLayoutItem,
} from "@/lib/dashboard-layout";

type ResizeMode = "right" | "bottom" | "corner";

interface DashboardGridProps {
    layout: DashboardLayoutItem[];
    editing: boolean;
    onReorder: (activeId: DashboardBlockId, overId: DashboardBlockId) => void;
    onResizeBlock: (id: DashboardBlockId, size: { width?: number; height?: number }) => void;
    renderWidget: (id: DashboardBlockId, item: DashboardLayoutItem) => React.ReactNode;
}

export function DashboardGrid({
    layout,
    editing,
    onReorder,
    onResizeBlock,
    renderWidget,
}: DashboardGridProps) {
    const gridRef = useRef<HTMLDivElement | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onReorder(active.id as DashboardBlockId, over.id as DashboardBlockId);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={layout.map(item => item.id)} strategy={rectSortingStrategy}>
                <div ref={gridRef} className="-m-2 flex flex-wrap items-start">
                    {layout.map(item => (
                        <DashboardWidget
                            key={item.id}
                            item={item}
                            editing={editing}
                            gridRef={gridRef}
                            onResizeBlock={onResizeBlock}
                            renderWidget={renderWidget}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

function DashboardWidget({
    item,
    editing,
    gridRef,
    onResizeBlock,
    renderWidget,
}: {
    item: DashboardLayoutItem;
    editing: boolean;
    gridRef: React.RefObject<HTMLDivElement | null>;
    onResizeBlock: (id: DashboardBlockId, size: { width?: number; height?: number }) => void;
    renderWidget: (id: DashboardBlockId, item: DashboardLayoutItem) => React.ReactNode;
}) {
    const [draftSize, setDraftSize] = useState<{ width: number; height: number } | null>(null);
    const [resizingMode, setResizingMode] = useState<ResizeMode | null>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled: !editing || resizingMode !== null });

    const activeItem: DashboardLayoutItem = draftSize
        ? { ...item, width: draftSize.width, height: draftSize.height }
        : item;

    const title = DASHBOARD_BLOCK_TITLES[item.id];

    const startResize = (mode: ResizeMode) => (e: ReactPointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const gridWidth = Math.max(gridRef.current?.getBoundingClientRect().width ?? 1200, 320);
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = item.width;
        const startHeight = item.height;

        let latestWidth = startWidth;
        let latestHeight = startHeight;

        setResizingMode(mode);
        setDraftSize({ width: startWidth, height: startHeight });

        const previousCursor = document.body.style.cursor;
        document.body.style.cursor =
            mode === "right" ? "ew-resize" : mode === "bottom" ? "ns-resize" : "nwse-resize";

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (mode === "right" || mode === "corner") {
                const deltaPct = ((moveEvent.clientX - startX) / gridWidth) * 100;
                latestWidth = clampWidthPct(startWidth + deltaPct);
            }
            if (mode === "bottom" || mode === "corner") {
                latestHeight = clampHeightPx(startHeight + (moveEvent.clientY - startY));
            }
            setDraftSize({ width: latestWidth, height: latestHeight });
        };

        const onPointerUp = () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            document.body.style.cursor = previousCursor;
            setResizingMode(null);
            setDraftSize(null);

            if (latestWidth !== startWidth || latestHeight !== startHeight) {
                onResizeBlock(item.id, { width: latestWidth, height: latestHeight });
            }
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp, { once: true });
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: resizingMode ? undefined : transition,
        zIndex: isDragging || resizingMode ? 20 : undefined,
        "--card-w": widthCssPercent(activeItem.width),
        "--card-h": `${activeItem.height + 16}px`,
    } as CSSProperties;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "w-full min-w-0 p-2 lg:h-[var(--card-h)] lg:w-[var(--card-w)]",
                isDragging && "opacity-75",
            )}
            {...(editing ? attributes : {})}
            {...(editing ? listeners : {})}
            aria-roledescription={editing ? `Card arrastável: ${title}` : undefined}
        >
            <div
                className={cn(
                    "group/widget relative h-full min-w-0 rounded-2xl",
                    editing && "cursor-grab select-none ring-1 ring-dashed ring-foreground/25 active:cursor-grabbing",
                    resizingMode && "ring-2 ring-blue-500/70 select-none",
                    isDragging && "shadow-lg ring-2 ring-foreground/40",
                )}
            >
                <div className={cn("h-full min-w-0", editing && "pointer-events-none")}>
                    {renderWidget(item.id, activeItem)}
                </div>

                {/* Right contour resize handle */}
                <div
                    onPointerDown={startResize("right")}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionar largura de ${title}`}
                    className="absolute inset-y-3 -right-1 z-10 hidden w-2.5 cursor-ew-resize items-center justify-center lg:flex"
                >
                    <span
                        className={cn(
                            "h-12 w-1 rounded-full bg-blue-500/0 transition-colors group-hover/widget:bg-foreground/15 hover:!bg-blue-500",
                            resizingMode === "right" && "!bg-blue-500",
                        )}
                    />
                </div>

                {/* Bottom contour resize handle */}
                <div
                    onPointerDown={startResize("bottom")}
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label={`Redimensionar altura de ${title}`}
                    className="absolute inset-x-3 -bottom-1 z-10 hidden h-2.5 cursor-ns-resize items-center justify-center lg:flex"
                >
                    <span
                        className={cn(
                            "h-1 w-12 rounded-full bg-blue-500/0 transition-colors group-hover/widget:bg-foreground/15 hover:!bg-blue-500",
                            resizingMode === "bottom" && "!bg-blue-500",
                        )}
                    />
                </div>

                {/* Bottom-right corner resize handle (both axes) */}
                <div
                    onPointerDown={startResize("corner")}
                    aria-label={`Redimensionar largura e altura de ${title}`}
                    className="absolute -bottom-1 -right-1 z-20 hidden h-4 w-4 cursor-nwse-resize items-end justify-end p-0.5 lg:flex"
                >
                    <span
                        className={cn(
                            "h-2.5 w-2.5 rounded-br-lg border-b-2 border-r-2 border-transparent transition-colors group-hover/widget:border-foreground/30 hover:!border-blue-500",
                            resizingMode === "corner" && "!border-blue-500",
                        )}
                    />
                </div>
            </div>
        </div>
    );
}
