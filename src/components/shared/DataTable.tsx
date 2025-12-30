import React from 'react';
import { FileX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// ============================================================
// DataTable - مكون جدول موحد مع حالات التحميل والفراغ
// ============================================================

export interface Column<T> {
    key: string;
    header: string;
    className?: string;
    render?: (item: T, index: number) => React.ReactNode;
    sortable?: boolean;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    isLoading?: boolean;
    emptyIcon?: React.ElementType;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: {
        label: string;
        onClick: () => void;
    };
    onRowClick?: (item: T) => void;
    className?: string;
    loadingRows?: number;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    keyField,
    isLoading = false,
    emptyIcon: EmptyIcon = FileX,
    emptyTitle = 'لا توجد بيانات',
    emptyDescription,
    emptyAction,
    onRowClick,
    className,
    loadingRows = 5,
}: DataTableProps<T>) {

    // حالة التحميل
    if (isLoading) {
        return (
            <div className={cn("rounded-md border", className)}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map(col => (
                                <TableHead key={col.key} className={col.className}>
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {columns.map((col) => (
                                    <TableCell key={col.key}>
                                        <Skeleton className="h-5 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    // حالة الفراغ
    if (!data || data.length === 0) {
        return (
            <div className={cn("text-center py-12 border rounded-lg bg-muted/20", className)}>
                <EmptyIcon size={48} className="mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                    {emptyTitle}
                </h3>
                {emptyDescription && (
                    <p className="text-sm text-muted-foreground/70 mb-4">
                        {emptyDescription}
                    </p>
                )}
                {emptyAction && (
                    <Button onClick={emptyAction.onClick}>
                        {emptyAction.label}
                    </Button>
                )}
            </div>
        );
    }

    // الجدول الفعلي
    return (
        <div className={cn("rounded-md border overflow-auto", className)}>
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map(col => (
                            <TableHead key={col.key} className={col.className}>
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow
                            key={String(item[keyField])}
                            className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                            onClick={() => onRowClick?.(item)}
                        >
                            {columns.map(col => (
                                <TableCell key={col.key} className={col.className}>
                                    {col.render
                                        ? col.render(item, index)
                                        : item[col.key]
                                    }
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default DataTable;
