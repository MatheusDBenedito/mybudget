"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
    ShoppingBag, Coffee, Home, Car, Plane, Gamepad2, HeartPulse,
    Briefcase, GraduationCap, ShoppingCart, Smartphone, Utensils,
    Music, Film, Dumbbell, Gift, Bus, Baby, Dog, Zap, Tag, Scissors,
    DollarSign, Wallet, PiggyBank, Landmark, CreditCard, Receipt,
    TrendingUp, TrendingDown, Stethoscope, Heart, Smile, Monitor,
    Book, Camera, Ticket, Train, MapPin, Wrench, PenTool, Shirt,
    Trophy, Tv, Umbrella, Cpu, Globe
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/auth";

const categorySchema = z.object({
    name: z.string().min(2, "A categoria deve ter pelo menos 2 caracteres."),
    color: z.string().optional(),
    icon: z.string().optional(),
});

type CategoryData = z.infer<typeof categorySchema>;

const CATEGORY_COLORS = [
    { value: "bg-red-500", label: "Vermelho" },
    { value: "bg-orange-500", label: "Laranja" },
    { value: "bg-amber-500", label: "Âmbar" },
    { value: "bg-yellow-500", label: "Amarelo" },
    { value: "bg-lime-500", label: "Limão" },
    { value: "bg-green-500", label: "Verde Claro" },
    { value: "bg-emerald-500", label: "Verde" },
    { value: "bg-teal-500", label: "Azul Piscina" },
    { value: "bg-cyan-500", label: "Ciano" },
    { value: "bg-sky-500", label: "Céu" },
    { value: "bg-blue-500", label: "Azul" },
    { value: "bg-indigo-500", label: "Índigo" },
    { value: "bg-violet-500", label: "Violeta" },
    { value: "bg-purple-500", label: "Roxo" },
    { value: "bg-fuchsia-500", label: "Fúcsia" },
    { value: "bg-pink-500", label: "Rosa Claro" },
    { value: "bg-rose-500", label: "Rosa Escuro" },
    { value: "bg-stone-500", label: "Pedra" },
    { value: "bg-neutral-800", label: "Preto" }
];

export const ICONS_MAP: Record<string, React.ElementType> = {
    ShoppingBag, Coffee, Home, Car, Plane, Gamepad2, HeartPulse,
    Briefcase, GraduationCap, ShoppingCart, Smartphone, Utensils,
    Music, Film, Dumbbell, Gift, Bus, Baby, Dog, Zap, Tag, Scissors,
    DollarSign, Wallet, PiggyBank, Landmark, CreditCard, Receipt,
    TrendingUp, TrendingDown, Stethoscope, Heart, Smile, Monitor,
    Book, Camera, Ticket, Train, MapPin, Wrench, PenTool, Shirt,
    Trophy, Tv, Umbrella, Cpu, Globe
};

export interface ApiCategory {
    id: string;
    name: string;
    color?: string;
    icon?: string;
}

interface CreateCategoryModalProps {
    children: React.ReactNode;
    initialData?: ApiCategory;
    onSuccess?: () => void;
}

export function CreateCategoryModal({ children, initialData, onSuccess }: CreateCategoryModalProps) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<CategoryData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: initialData?.name || "",
            color: initialData?.color || CATEGORY_COLORS[0].value,
            icon: initialData?.icon || "ShoppingBag",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: initialData?.name || "",
                color: initialData?.color || CATEGORY_COLORS[0].value,
                icon: initialData?.icon || "ShoppingBag",
            });
        }
    }, [open, initialData, form]);

    const onSubmit = async (data: CategoryData) => {
        setIsSaving(true);
        try {
            const url = initialData?.id
                ? `${API_BASE_URL}/categories/${initialData.id}`
                : `${API_BASE_URL}/categories`;
            const method = initialData?.id ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                toast.success(initialData?.id ? "Categoria atualizada!" : "Categoria cadastrada!");
                setOpen(false);
                if (onSuccess) onSuccess();
            } else {
                toast.error("Erro ao salvar categoria.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro de conexão com a API.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome da Categoria</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Alimentação, Transporte, Lazer..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Color Picker Grid */}
                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cor Visual</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {CATEGORY_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => field.onChange(c.value)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-full transition-all border-2",
                                                        c.value,
                                                        field.value === c.value ? "ring-2 ring-offset-2 ring-gray-600 border-white scale-110" : "border-transparent hover:scale-105 opacity-80"
                                                    )}
                                                    title={c.label}
                                                />
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Icon Picker Grid */}
                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ícone</FormLabel>
                                    <FormControl>
                                        <div className="grid grid-cols-6 gap-2 mt-2 max-h-40 overflow-y-auto p-1">
                                            {Object.keys(ICONS_MAP).map(iconName => {
                                                const IconComponent = ICONS_MAP[iconName];
                                                return (
                                                    <button
                                                        key={iconName}
                                                        type="button"
                                                        onClick={() => field.onChange(iconName)}
                                                        className={cn(
                                                            "p-2 rounded-md flex items-center justify-center transition-all",
                                                            field.value === iconName
                                                                ? "bg-gray-100 ring-2 ring-gray-900 shadow-sm"
                                                                : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                                                        )}
                                                        title={iconName}
                                                    >
                                                        <IconComponent className="h-5 w-5" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                                {isSaving ? "Salvando..." : "Salvar Categoria"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
