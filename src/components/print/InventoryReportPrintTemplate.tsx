import React, { forwardRef } from 'react';
import { Package, Warehouse, AlertTriangle } from 'lucide-react';
import {
    PrintContainer,
    PrintHeader,
    PrintFooter,
    PrintSignature,
    PRINT_CONFIG,
} from './PrintDesignSystem';

// ============================================================
// Inventory Report Print Template - قالب طباعة تقرير المخزون
// ============================================================

/** Format currency with English digits */
function fmtMoney(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount) + ' ج.م';
}

function fmtDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('ar-u-nu-latn', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(d);
}

function fmtNum(n: number): string {
    return new Intl.NumberFormat('en-EG').format(n);
}

export interface InventoryReportItem {
    productCode: string;
    productName: string;
    productType: string;
    unit: string;
    warehouseName: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    avgCost: number;
    minStock: number;
    totalValue: number;
    status: 'available' | 'low' | 'out';
}

export interface InventoryReportData {
    items: InventoryReportItem[];
    filters: {
        warehouse: string;
        stockFilter: string;
        search: string;
    };
    stats: {
        totalItems: number;
        totalValue: number;
        lowStock: number;
        outOfStock: number;
    };
}

const productTypeLabels: Record<string, string> = {
    part: 'قطعة غيار',
    consumable: 'مستهلك',
    service: 'خدمة',
};

const statusLabels: Record<string, string> = {
    available: 'متوفر',
    low: 'نقص',
    out: 'نفد',
};

const statusColors: Record<string, string> = {
    available: '#15803d',
    low: '#d97706',
    out: '#dc2626',
};

const thStyle: React.CSSProperties = {
    padding: '8px 6px',
    backgroundColor: PRINT_CONFIG.primaryColor,
    color: '#fff',
    fontWeight: 700,
    fontSize: '10px',
    textAlign: 'center',
    border: '1px solid #d1d5db',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '6px',
    fontSize: '10px',
    border: '1px solid #e5e7eb',
    verticalAlign: 'middle',
    lineHeight: '1.5',
};

interface InventoryReportPrintProps {
    data: InventoryReportData;
}

export const InventoryReportPrintTemplate = forwardRef<HTMLDivElement, InventoryReportPrintProps>(
    ({ data }, ref) => {
        const activeFilters: string[] = [];
        if (data.filters.warehouse && data.filters.warehouse !== 'all') activeFilters.push(`المخزن: ${data.filters.warehouse}`);
        if (data.filters.stockFilter === 'low') activeFilters.push('حالة: نقص مخزون');
        if (data.filters.stockFilter === 'out') activeFilters.push('حالة: نفد المخزون');
        if (data.filters.search) activeFilters.push(`بحث: "${data.filters.search}"`);

        return (
            <PrintContainer ref={ref}>
                <PrintHeader
                    title="تقرير أرصدة المخزون"
                    subtitle="Inventory Balance Report"
                    documentDate={fmtDate(new Date())}
                />

                {/* Active Filters */}
                {activeFilters.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                        padding: '8px 12px', borderRadius: '6px', marginBottom: '12px',
                        backgroundColor: '#fffbeb', border: '1px solid #fcd34d', fontSize: '11px',
                    }}>
                        <span style={{ fontWeight: 700, color: '#92400e' }}>فلاتر نشطة:</span>
                        {activeFilters.map((f, i) => (
                            <span key={i} style={{
                                padding: '2px 8px', borderRadius: '4px',
                                backgroundColor: '#fef3c7', color: '#92400e', fontSize: '10px',
                            }}>
                                {f}
                            </span>
                        ))}
                    </div>
                )}

                {/* Summary Stats */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px',
                    marginBottom: '16px', pageBreakInside: 'avoid',
                }}>
                    {[
                        { label: 'إجمالي الأصناف', value: fmtNum(data.stats.totalItems), color: PRINT_CONFIG.primaryColor, bg: '#f0f7ff' },
                        { label: 'قيمة المخزون', value: fmtMoney(data.stats.totalValue), color: '#15803d', bg: '#f0fdf4' },
                        { label: 'نقص مخزون', value: fmtNum(data.stats.lowStock), color: '#d97706', bg: '#fffbeb' },
                        { label: 'نفد المخزون', value: fmtNum(data.stats.outOfStock), color: '#dc2626', bg: '#fef2f2' },
                    ].map((stat, i) => (
                        <div key={i} style={{
                            padding: '10px', borderRadius: '6px', textAlign: 'center',
                            backgroundColor: stat.bg, border: `1px solid ${stat.color}30`,
                        }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: stat.color }}>{stat.value}</p>
                            <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Inventory Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '30px' }}>#</th>
                            <th style={{ ...thStyle, width: '70px' }}>الكود</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>المنتج</th>
                            <th style={{ ...thStyle, width: '65px' }}>النوع</th>
                            <th style={{ ...thStyle, width: '70px' }}>المخزن</th>
                            <th style={{ ...thStyle, width: '55px' }}>الكمية</th>
                            <th style={{ ...thStyle, width: '50px' }}>محجوز</th>
                            <th style={{ ...thStyle, width: '50px' }}>متاح</th>
                            <th style={{ ...thStyle, width: '80px' }}>التكلفة</th>
                            <th style={{ ...thStyle, width: '85px' }}>القيمة</th>
                            <th style={{ ...thStyle, width: '45px' }}>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, i) => (
                            <tr key={i} style={{
                                backgroundColor: item.status === 'out' ? '#fef2f2'
                                    : item.status === 'low' ? '#fffbeb'
                                    : i % 2 === 0 ? '#fff' : '#f9fafb',
                            }}>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>{i + 1}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontSize: '9px' }}>{item.productCode}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{item.productName}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{productTypeLabels[item.productType] || item.productType}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.warehouseName}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                                    {fmtNum(item.quantity)} {item.unit}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', color: '#6b7280' }}>{fmtNum(item.reservedQuantity)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{fmtNum(item.availableQuantity)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{fmtMoney(item.avgCost)}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>{fmtMoney(item.totalValue)}</td>
                                <td style={{
                                    ...tdStyle, textAlign: 'center', fontWeight: 700, fontSize: '9px',
                                    color: statusColors[item.status] || '#374151',
                                }}>
                                    {statusLabels[item.status] || item.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: 700, backgroundColor: `${PRINT_CONFIG.primaryColor}10` }}>
                            <td colSpan={5} style={{ ...tdStyle, textAlign: 'right', color: PRINT_CONFIG.primaryColor, padding: '8px 6px' }}>
                                الإجمالي
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', color: PRINT_CONFIG.primaryColor, padding: '8px 6px' }}>
                                {fmtNum(data.items.reduce((s, i) => s + i.quantity, 0))}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', color: '#6b7280', padding: '8px 6px' }}>
                                {fmtNum(data.items.reduce((s, i) => s + i.reservedQuantity, 0))}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', color: PRINT_CONFIG.primaryColor, padding: '8px 6px' }}>
                                {fmtNum(data.items.reduce((s, i) => s + i.availableQuantity, 0))}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', padding: '8px 6px' }}>-</td>
                            <td style={{
                                ...tdStyle, textAlign: 'center', fontFamily: 'monospace', padding: '8px 6px',
                                backgroundColor: PRINT_CONFIG.primaryColor, color: '#fff',
                            }}>
                                {fmtMoney(data.stats.totalValue)}
                            </td>
                            <td style={{ ...tdStyle, padding: '8px 6px' }}></td>
                        </tr>
                    </tfoot>
                </table>

                {/* Signatures */}
                <PrintSignature
                    signatures={[
                        { title: 'أمين المخزن' },
                        { title: 'المحاسب' },
                        { title: 'المدير' },
                    ]}
                />

                <PrintFooter message="تقرير أرصدة المخزون — هذا التقرير يعكس الأرصدة في وقت الطباعة وقد يختلف عن الأرصدة الفعلية لاحقاً" />
            </PrintContainer>
        );
    }
);

InventoryReportPrintTemplate.displayName = 'InventoryReportPrintTemplate';

export default InventoryReportPrintTemplate;
