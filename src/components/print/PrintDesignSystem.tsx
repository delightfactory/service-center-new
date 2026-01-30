import React from 'react';
import { Phone, MapPin, Mail, Globe } from 'lucide-react';

// ============================================================
// نظام التصميم الموحد للطباعة
// Professional Print Design System
// ============================================================

// ============================================================
// Configuration - إعدادات المركز
// ============================================================
export const PRINT_CONFIG = {
    centerName: 'مركز أبو زياد لصيانة السيارات',
    centerNameEn: 'Abu Ziad Auto Service Center',
    logoUrl: '/icons/android-chrome-192x192.webp',
    address: 'طنطا -شارع توت عنخ امون',
    phone: '01097079970',
    phone2: '01001443442',
    email: 'info@abuziad.com',
    website: 'www.abuziad.com',
    taxNumber: '',
    commercialRegister: '',
    // Colors
    primaryColor: '#1e3a5f',
    secondaryColor: '#2d5a87',
    accentColor: '#f59e0b',
};

// ============================================================
// Print Styles - أنماط الطباعة
// ============================================================
export const printStyles = `
    @media print {
        body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        @page { 
            size: A4; 
            margin: 10mm 15mm;
        }
        table { page-break-inside: avoid; }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
    }
    @media screen {
        .print-only { display: none; }
    }
`;

// ============================================================
// PrintHeader - رأس المطبوعة (مُحسّن)
// ============================================================
interface PrintHeaderProps {
    title: string;
    subtitle?: string;
    documentNumber?: string;
    documentDate?: string;
    showLogo?: boolean;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
    title,
    subtitle,
    documentNumber,
    documentDate,
    showLogo = true,
}) => {
    return (
        <div className="mb-4">
            {/* Main Header Row */}
            <div className="flex justify-between items-center pb-3 border-b-2" style={{ borderColor: PRINT_CONFIG.primaryColor }}>
                {/* Logo + Company Name */}
                <div className="flex items-center gap-3">
                    {showLogo && (
                        <img
                            src={PRINT_CONFIG.logoUrl}
                            alt="Logo"
                            className="h-14 w-14 object-contain"
                        />
                    )}
                    <div>
                        <h1
                            className="text-xl font-bold leading-tight"
                            style={{ color: PRINT_CONFIG.primaryColor }}
                        >
                            {PRINT_CONFIG.centerName}
                        </h1>
                        <p className="text-xs text-gray-500">{PRINT_CONFIG.centerNameEn}</p>
                    </div>
                </div>

                {/* Document Type Badge */}
                <div
                    className="px-4 py-2 rounded text-white text-center min-w-[140px]"
                    style={{ backgroundColor: PRINT_CONFIG.primaryColor }}
                >
                    <p className="text-lg font-bold leading-tight">{title}</p>
                    {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
                </div>
            </div>

            {/* Info Row */}
            <div className="flex justify-between items-center py-2 text-sm border-b border-gray-200">
                {/* Contact Info */}
                <div className="flex gap-4 text-gray-600">
                    <span className="flex items-center gap-1">
                        <Phone size={11} />
                        {PRINT_CONFIG.phone}
                    </span>
                    <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {PRINT_CONFIG.address}
                    </span>
                </div>

                {/* Document Info */}
                <div className="flex gap-4 text-gray-700">
                    {documentNumber && (
                        <span>
                            <span className="text-gray-500">رقم: </span>
                            <span className="font-mono font-bold">{documentNumber}</span>
                        </span>
                    )}
                    {documentDate && (
                        <span>
                            <span className="text-gray-500">التاريخ: </span>
                            <span className="font-medium">{documentDate}</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// PrintFooter - تذييل المطبوعة (مُحسّن)
// ============================================================
interface PrintFooterProps {
    message?: string;
    showPrintDate?: boolean;
    compact?: boolean;
}

export const PrintFooter: React.FC<PrintFooterProps> = ({
    message = 'شكراً لثقتكم في خدماتنا',
    showPrintDate = true,
    compact = false,
}) => {
    if (compact) {
        return (
            <div className="mt-4 pt-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
                <span>{message}</span>
                <div className="flex gap-3">
                    <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {PRINT_CONFIG.phone}
                    </span>
                    {showPrintDate && (
                        <span>طُبع: {new Date().toLocaleDateString('ar-EG')}</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6 pt-3 border-t border-gray-300">
            {/* Thank you message */}
            <p
                className="text-center font-bold mb-2"
                style={{ color: PRINT_CONFIG.primaryColor }}
            >
                {message}
            </p>

            {/* Contact strip */}
            <div
                className="flex justify-center items-center gap-6 py-2 rounded text-white text-sm"
                style={{ backgroundColor: PRINT_CONFIG.primaryColor }}
            >
                <span className="flex items-center gap-1">
                    <Phone size={12} />
                    {PRINT_CONFIG.phone}
                </span>
                {PRINT_CONFIG.phone2 && (
                    <span className="flex items-center gap-1">
                        <Phone size={12} />
                        {PRINT_CONFIG.phone2}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {PRINT_CONFIG.address}
                </span>
            </div>

            {showPrintDate && (
                <p className="text-center text-xs text-gray-400 mt-1">
                    تم الطباعة: {new Date().toLocaleString('ar-EG')}
                </p>
            )}
        </div>
    );
};

// ============================================================
// PrintDataSection - قسم البيانات
// ============================================================
interface PrintDataSectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    variant?: 'default' | 'highlight';
}

export const PrintDataSection: React.FC<PrintDataSectionProps> = ({
    title,
    icon,
    children,
    variant = 'default',
}) => {
    return (
        <div
            className={`rounded p-2 mb-2 ${variant === 'highlight'
                ? 'border-2'
                : 'bg-gray-50 border border-gray-200'
                }`}
            style={variant === 'highlight' ? { borderColor: PRINT_CONFIG.primaryColor } : {}}
        >
            <h3
                className="font-bold text-sm mb-1 flex items-center gap-1 pb-1 border-b border-gray-200"
                style={{ color: PRINT_CONFIG.primaryColor }}
            >
                {icon}
                {title}
            </h3>
            <div className="text-xs space-y-0.5">
                {children}
            </div>
        </div>
    );
};

// ============================================================
// PrintDataRow - صف بيانات
// ============================================================
interface PrintDataRowProps {
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
}

export const PrintDataRow: React.FC<PrintDataRowProps> = ({
    label,
    value,
    highlight = false,
}) => {
    return (
        <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-600 text-xs">{label}:</span>
            <span className={`font-medium text-xs ${highlight ? 'text-sm' : ''}`}
                style={highlight ? { color: PRINT_CONFIG.primaryColor } : {}}
            >
                {value}
            </span>
        </div>
    );
};

// ============================================================
// PrintTable - جدول احترافي
// ============================================================
interface PrintTableColumn {
    key: string;
    label: string;
    align?: 'right' | 'center' | 'left';
    width?: string;
}

interface PrintTableProps {
    columns: PrintTableColumn[];
    data: Record<string, any>[];
    showRowNumbers?: boolean;
}

export const PrintTable: React.FC<PrintTableProps> = ({
    columns,
    data,
    showRowNumbers = true,
}) => {
    return (
        <table className="w-full border-collapse mb-3 text-xs">
            <thead>
                <tr style={{ backgroundColor: PRINT_CONFIG.primaryColor }}>
                    {showRowNumbers && (
                        <th className="px-1 py-1 text-white text-center border border-gray-300 w-8">
                            #
                        </th>
                    )}
                    {columns.map(col => (
                        <th
                            key={col.key}
                            className={`px-2 py-1 text-white border border-gray-300 text-${col.align || 'right'}`}
                            style={{ width: col.width }}
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, index) => (
                    <tr
                        key={index}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                        {showRowNumbers && (
                            <td className="px-1 py-1 border border-gray-200 text-center text-gray-500">
                                {index + 1}
                            </td>
                        )}
                        {columns.map(col => (
                            <td
                                key={col.key}
                                className={`px-2 py-1 border border-gray-200 text-${col.align || 'right'}`}
                            >
                                {row[col.key]}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

// ============================================================
// PrintTotals - ملخص المبالغ
// ============================================================
interface PrintTotalsProps {
    items: {
        label: string;
        value: string | number;
        type?: 'normal' | 'discount' | 'total' | 'paid' | 'remaining';
    }[];
}

export const PrintTotals: React.FC<PrintTotalsProps> = ({ items }) => {
    const getStyle = (type: string) => {
        switch (type) {
            case 'discount':
                return { bg: 'bg-green-50', text: 'text-green-700' };
            case 'total':
                return { bg: '', text: 'text-white', bgColor: PRINT_CONFIG.primaryColor };
            case 'paid':
                return { bg: 'bg-green-50', text: 'text-green-700' };
            case 'remaining':
                return { bg: 'bg-orange-50', text: 'text-orange-700' };
            default:
                return { bg: 'bg-gray-50', text: 'text-gray-800' };
        }
    };

    return (
        <div className="w-56 border rounded overflow-hidden mr-auto text-xs">
            {items.map((item, index) => {
                const style = getStyle(item.type || 'normal');
                return (
                    <div
                        key={index}
                        className={`flex justify-between px-2 py-1 border-b last:border-b-0 ${style.bg} ${style.text} ${item.type === 'total' ? 'font-bold text-sm' : ''}`}
                        style={item.type === 'total' ? { backgroundColor: style.bgColor } : {}}
                    >
                        <span>{item.label}:</span>
                        <span>{typeof item.value === 'number' ? item.value.toLocaleString('ar-EG') : item.value}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// PrintSignature - منطقة التوقيع
// ============================================================
interface PrintSignatureProps {
    signatures: {
        title: string;
        name?: string;
    }[];
}

export const PrintSignature: React.FC<PrintSignatureProps> = ({ signatures }) => {
    return (
        <div className={`grid gap-4 mt-6 pt-4 border-t border-gray-300`}
            style={{ gridTemplateColumns: `repeat(${signatures.length}, 1fr)` }}
        >
            {signatures.map((sig, index) => (
                <div key={index} className="text-center">
                    <p className="font-bold text-xs mb-6 text-gray-700">{sig.title}</p>
                    <div className="border-b border-gray-400 w-28 mx-auto"></div>
                    {sig.name && (
                        <p className="text-xs text-gray-500 mt-1">{sig.name}</p>
                    )}
                </div>
            ))}
        </div>
    );
};

// ============================================================
// PrintContainer - حاوية المطبوعة
// ============================================================
interface PrintContainerProps {
    children: React.ReactNode;
}

export const PrintContainer = React.forwardRef<HTMLDivElement, PrintContainerProps>(
    ({ children }, ref) => {
        return (
            <>
                <style>{printStyles}</style>
                <div
                    ref={ref}
                    className="bg-white text-black p-4 max-w-[210mm] mx-auto print:p-4 print:max-w-none text-sm"
                    style={{ fontFamily: 'Cairo, Arial, sans-serif', fontSize: '12px' }}
                    dir="rtl"
                >
                    {children}
                </div>
            </>
        );
    }
);

PrintContainer.displayName = 'PrintContainer';

export default {
    PRINT_CONFIG,
    PrintContainer,
    PrintHeader,
    PrintFooter,
    PrintDataSection,
    PrintDataRow,
    PrintTable,
    PrintTotals,
    PrintSignature,
};
