"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    DEFAULT_LAYOUT,
    moveBy,
    moveTo,
    normalizeLayout,
    readCachedLayout,
    setWidth,
    writeCachedLayout,
    type DashboardBlockId,
    type DashboardLayoutItem,
    type DashboardWidth,
} from "@/lib/dashboard-layout";
import { fetchDashboardLayout, saveDashboardLayout } from "@/lib/dashboard-layout-api";

const SAVE_DEBOUNCE_MS = 400;

/**
 * Loads the summary layout (cache first for a quick paint, then the database) and
 * persists every change optimistically, reverting on failure.
 */
export function useDashboardLayout() {
    const [layout, setLayout] = useState<DashboardLayoutItem[]>(DEFAULT_LAYOUT);
    const [editing, setEditing] = useState(false);

    const layoutRef = useRef<DashboardLayoutItem[]>(DEFAULT_LAYOUT);
    const lastSavedRef = useRef<DashboardLayoutItem[]>(DEFAULT_LAYOUT);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seqRef = useRef(0);
    const dirtyRef = useRef(false);

    useEffect(() => {
        const cached = readCachedLayout();
        if (cached) {
            layoutRef.current = cached;
            lastSavedRef.current = cached;
            setLayout(cached);
        }

        let cancelled = false;
        fetchDashboardLayout()
            .then(items => {
                if (cancelled || dirtyRef.current) return;
                layoutRef.current = items;
                lastSavedRef.current = items;
                setLayout(items);
                writeCachedLayout(items);
            })
            .catch(() => {
                // Keep the cached/default layout when the API is unavailable.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const persist = useCallback(async (next: DashboardLayoutItem[], seq: number) => {
        try {
            const saved = await saveDashboardLayout(next);
            if (seq !== seqRef.current) return;
            lastSavedRef.current = saved;
            layoutRef.current = saved;
            writeCachedLayout(saved);
        } catch {
            if (seq !== seqRef.current) return;
            layoutRef.current = lastSavedRef.current;
            setLayout(lastSavedRef.current);
            writeCachedLayout(lastSavedRef.current);
            toast.error("Não foi possível salvar a personalização do Resumo.");
        }
    }, []);

    const scheduleSave = useCallback((next: DashboardLayoutItem[]) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const seq = ++seqRef.current;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void persist(next, seq);
        }, SAVE_DEBOUNCE_MS);
    }, [persist]);

    const apply = useCallback((next: DashboardLayoutItem[]) => {
        const normalized = normalizeLayout(next);
        dirtyRef.current = true;
        layoutRef.current = normalized;
        setLayout(normalized);
        writeCachedLayout(normalized);
        scheduleSave(normalized);
    }, [scheduleSave]);

    const move = useCallback((id: DashboardBlockId, direction: -1 | 1) => {
        apply(moveBy(layoutRef.current, id, direction));
    }, [apply]);

    const reorder = useCallback((activeId: DashboardBlockId, overId: DashboardBlockId) => {
        apply(moveTo(layoutRef.current, activeId, overId));
    }, [apply]);

    const resize = useCallback((id: DashboardBlockId, width: DashboardWidth) => {
        apply(setWidth(layoutRef.current, id, width));
    }, [apply]);

    const reset = useCallback(() => {
        apply(DEFAULT_LAYOUT);
        toast.success("Layout padrão restaurado.");
    }, [apply]);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const seq = ++seqRef.current;
        void persist(layoutRef.current, seq);
    }, [persist]);

    const finishEditing = useCallback(() => {
        setEditing(false);
        flush();
    }, [flush]);

    return {
        layout,
        editing,
        setEditing,
        move,
        reorder,
        resize,
        reset,
        finishEditing,
    };
}
