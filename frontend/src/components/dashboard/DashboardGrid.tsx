"use client";

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
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DASHBOARD_BLOCK_TITLES,
    DASHBOARD_WIDTHS,
    DASHBOARD_WIDTH_LABELS,
    type DashboardBlockId,
    type DashboardLayoutItem,
    type DashboardWidth,
} from "@/lib/dashboard-layout";

const WIDTH_CLASS: Record<DashboardWidth, string> = {
    4: "lg:col-span-4",
    6: "lg:col-span-6",
    8: "lg:col-span-8",
    12: "lg:col-span-12",
};

interface DashboardGridProps {
    layout: DashboardLayoutItem[];
    editing: boolean;
    onMove: (id: DashboardBlockId, direction: -1 | 1) => void;
    onReorder: (activeId: DashboardBlockId, overId: DashboardBlockId) => void;
    onResize: (id: DashboardBlockId, width: DashboardWidth) => void;
    renderWidget: (id: DashboardBlockId) => React.ReactNode;
}

export function DashboardGrid({
    layout,
    editing,
    onMove,
    onReorder,
    onResize,
    renderWidget,
}: DashboardGridProps) {
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
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                    {layout.map((item, index) => (
                        <DashboardWidget
                            key={item.id}
                            item={item}
                            index={index}
                            count={layout.length}
                            editing={editing}
                            onMove={onMove}
                            onResize={onResize}
                        >
                            {renderWidget(item.id)}
                        </DashboardWidget>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

function DashboardWidget({
    item,
    index,
    count,
    editing,
    onMove,
    onResize,
    children,
}: {
    item: DashboardLayoutItem;
    index: number;
    count: number;
    editing: boolean;
    onMove: (id: DashboardBlockId, direction: -1 | 1) => void;
    onResize: (id: DashboardBlockId, width: DashboardWidth) => void;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled: !editing });

    const title = DASHBOARD_BLOCK_TITLES[item.id];

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                zIndex: isDragging ? 20 : undefined,
            }}
            className={cn(
                "min-w-0",
                WIDTH_CLASS[item.width],
                isDragging && "opacity-60",
            )}
        >
            {editing && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 shadow-sm">
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        aria-label={`Arrastar ${title}`}
                        title="Arrastar"
                        className="flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                    >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <span className="text-xs font-medium text-foreground">{title}</span>

                    <div className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMove(item.id, -1)}
                            disabled={index === 0}
                            aria-label={`Mover ${title} para a esquerda`}
                            title="Mover para a esquerda"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onMove(item.id, 1)}
                            disabled={index === count - 1}
                            aria-label={`Mover ${title} para a direita`}
                            title="Mover para a direita"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

                        <div className="flex items-center gap-1" role="group" aria-label={`Largura de ${title}`}>
                            {DASHBOARD_WIDTHS.map(width => (
                                <button
                                    key={width}
                                    type="button"
                                    onClick={() => onResize(item.id, width)}
                                    aria-pressed={item.width === width}
                                    aria-label={`Largura ${DASHBOARD_WIDTH_LABELS[width]}`}
                                    className={cn(
                                        "h-6 rounded px-1.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                        item.width === width
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    {DASHBOARD_WIDTH_LABELS[width]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {children}
        </div>
    );
}
