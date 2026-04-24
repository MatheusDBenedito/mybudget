"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateCategoryModal, ApiCategory, ICONS_MAP } from "./CreateCategoryModal";
import { cn } from "@/lib/utils";

export function CategoryManager() {
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("http://localhost:3333/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (error) {
            console.error("Failed to load categories", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando categorias...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Suas Categorias</h3>
                    <p className="text-sm text-gray-500">Gerencie as categorias usadas para classificar suas despesas e receitas.</p>
                </div>
                <CreateCategoryModal onSuccess={loadCategories}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Categoria
                    </Button>
                </CreateCategoryModal>
            </div>

            {categories.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
                    <p className="text-gray-500">Nenhuma categoria cadastrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.map(category => {
                        const IconComponent = category.icon && ICONS_MAP[category.icon]
                            ? ICONS_MAP[category.icon]
                            : ICONS_MAP['ShoppingBag'];

                        return (
                            <CreateCategoryModal key={category.id} initialData={category} onSuccess={loadCategories}>
                                <div className="group relative flex items-center p-4 rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer overflow-hidden">
                                    <div className={cn(
                                        "flex items-center justify-center p-3 rounded-full mr-4 shadow-sm text-white",
                                        category.color || "bg-gray-800"
                                    )}>
                                        <IconComponent className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                            {category.name}
                                        </p>
                                    </div>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Editar</span>
                                    </div>
                                </div>
                            </CreateCategoryModal>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
