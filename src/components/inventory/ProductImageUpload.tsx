import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Image as ImageIcon, Upload, Trash2, Loader2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// Product Image Upload - رفع صورة المنتج
// ============================================================

interface ProductImageUploadProps {
    productId: string;
    currentImageUrl?: string | null;
    onImageChange?: (url: string | null) => void;
    className?: string;
}

export function ProductImageUpload({
    productId,
    currentImageUrl,
    onImageChange,
    className
}: ProductImageUploadProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
    const [isDragging, setIsDragging] = useState(false);

    // Upload image mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            // Validate file
            if (!file.type.startsWith('image/')) {
                throw new Error('يجب أن يكون الملف صورة');
            }
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('حجم الصورة يجب أن يكون أقل من 5MB');
            }

            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${productId}-${Date.now()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            // Delete old image if exists
            if (currentImageUrl) {
                const oldPath = currentImageUrl.split('/').pop();
                if (oldPath) {
                    await supabase.storage.from('product-images').remove([`products/${oldPath}`]);
                }
            }

            // Upload new image
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            // Update product with image URL
            const { error: updateError } = await supabase
                .from('products')
                .update({ image_url: publicUrl })
                .eq('id', productId);

            if (updateError) throw updateError;

            return publicUrl;
        },
        onSuccess: (url) => {
            setPreviewUrl(url);
            onImageChange?.(url);
            queryClient.invalidateQueries({ queryKey: ['product', productId] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: Error) => {
            alert('فشل رفع الصورة: ' + error.message);
        },
    });

    // Delete image mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!currentImageUrl) return;

            // Extract filename from URL
            const urlParts = currentImageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];

            // Delete from storage
            const { error: deleteError } = await supabase.storage
                .from('product-images')
                .remove([`products/${fileName}`]);

            if (deleteError) throw deleteError;

            // Update product to remove image URL
            const { error: updateError } = await supabase
                .from('products')
                .update({ image_url: null })
                .eq('id', productId);

            if (updateError) throw updateError;
        },
        onSuccess: () => {
            setPreviewUrl(null);
            onImageChange?.(null);
            queryClient.invalidateQueries({ queryKey: ['product', productId] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: Error) => {
            alert('فشل حذف الصورة: ' + error.message);
        },
    });

    const handleFileSelect = useCallback((file: File) => {
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        uploadMutation.mutate(file);
    }, [uploadMutation]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const isLoading = uploadMutation.isPending || deleteMutation.isPending;

    return (
        <Card
            className={cn(
                "relative overflow-hidden border-2 border-dashed transition-colors",
                isDragging && "border-primary bg-primary/5",
                previewUrl && "border-solid",
                className
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
            />

            {previewUrl ? (
                // Image Preview
                <div className="relative aspect-square">
                    <img
                        src={previewUrl}
                        alt="صورة المنتج"
                        className="w-full h-full object-cover"
                    />

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <Camera size={20} />
                        </Button>
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteMutation.mutate()}
                            disabled={isLoading}
                        >
                            <Trash2 size={20} />
                        </Button>
                    </div>

                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    )}
                </div>
            ) : (
                // Upload Placeholder
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full aspect-square flex flex-col items-center justify-center gap-3 p-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="animate-spin" size={40} />
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <ImageIcon size={32} />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">اسحب الصورة هنا</p>
                                <p className="text-sm text-muted-foreground">أو انقر للاختيار</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Upload size={14} />
                                <span>PNG, JPG حتى 5MB</span>
                            </div>
                        </>
                    )}
                </button>
            )}
        </Card>
    );
}

export default ProductImageUpload;
