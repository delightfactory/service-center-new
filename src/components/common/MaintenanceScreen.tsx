/**
 * MaintenanceScreen - Professional Service Suspension Page
 * 
 * This component displays a professional maintenance page when the site
 * is suspended due to payment issues. Designed to look like an authentic
 * enterprise-level hosting provider suspension notice.
 */

import { useMemo } from 'react';

export function MaintenanceScreen() {
    // Generate a stable incident ID that persists during the session
    const incidentId = useMemo(() => {
        const timestamp = Math.floor(Date.now() / 86400000);
        const hash = timestamp.toString(36).toUpperCase().padStart(6, '0');
        return `SRV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${hash}`;
    }, []);

    // Get current date for suspension notice
    const suspensionDate = useMemo(() => {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
            {/* Subtle grid background */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Main Content - Centered */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="relative max-w-2xl w-full">
                    {/* Main Card */}
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">

                        {/* Header Bar */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-white font-bold text-lg">Account Suspended</h1>
                                    <p className="text-red-100 text-sm">Service provisioning halted</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 md:p-8">

                            {/* Error Code */}
                            <div className="flex justify-center mb-6">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <code className="text-slate-400 text-sm font-mono">
                                        HTTP 402 • SERVICE_NON_COMPLIANT
                                    </code>
                                </div>
                            </div>

                            {/* Main Message - English */}
                            <div className="text-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">
                                    Service Provisioning Suspended
                                </h2>
                                <p className="text-slate-400 leading-relaxed max-w-lg mx-auto mb-4">
                                    Service provisioning has been suspended due to account non-compliance
                                    with service terms. This action was taken in accordance with our
                                    service level agreement. The account holder must address outstanding
                                    compliance issues to reinstate services.
                                </p>

                                {/* Multi-language Notes - Small text */}
                                <div className="border-t border-slate-800 pt-4 mt-4 max-w-xl mx-auto space-y-3">
                                    {/* French */}
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        <span className="text-slate-600 font-medium mr-1">FR:</span>
                                        La fourniture de services a été suspendue en raison du non-respect
                                        des conditions de service par le compte. Cette action a été prise
                                        conformément à notre accord de niveau de service.
                                    </p>

                                    {/* Chinese */}
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        <span className="text-slate-600 font-medium mr-1">中文:</span>
                                        由于账户未遵守服务条款，服务供应已被暂停。此操作是根据我们的服务级别协议采取的。
                                        账户持有人必须解决未决的合规问题才能恢复服务。
                                    </p>

                                    {/* Arabic */}
                                    <p className="text-slate-500 text-xs leading-relaxed" dir="rtl">
                                        <span className="text-slate-600 font-medium ml-1">AR:</span>
                                        تم إيقاف تقديم الخدمة بسبب عدم امتثال الحساب لشروط الخدمة.
                                        تم اتخاذ هذا الإجراء وفقاً لاتفاقية مستوى الخدمة.
                                        يتوجب على صاحب الحساب معالجة مسائل الامتثال المعلقة لاستعادة الخدمات.
                                    </p>
                                </div>
                            </div>

                            {/* Technical Details */}
                            <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden mb-6">
                                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700">
                                    <span className="text-slate-300 text-sm font-medium">
                                        Suspension Details
                                    </span>
                                </div>
                                <div className="p-4 space-y-3 font-mono text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Status</span>
                                        <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-semibold">
                                            NON-COMPLIANT
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Reason Code</span>
                                        <span className="text-amber-400">SLA_VIOLATION_T2</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Ticket Reference</span>
                                        <span className="text-slate-300">{incidentId}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Effective Date</span>
                                        <span className="text-slate-300">{suspensionDate}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Account Status</span>
                                        <span className="text-red-400">SUSPENDED</span>
                                    </div>
                                </div>
                            </div>

                            {/* Resolution Notice */}
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm">
                                        <p className="text-amber-400 font-medium mb-1">Resolution Required</p>
                                        <p className="text-slate-400">
                                            Account holder must contact service administration to resolve
                                            outstanding compliance matters. Service restoration is subject
                                            to full resolution of all pending issues.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Visitor Notice */}
                            <div className="text-center text-sm border-t border-slate-800 pt-5">
                                <p className="text-slate-500 mb-1">
                                    If you are a visitor, please try again later.
                                </p>
                                <p className="text-slate-600 text-xs">
                                    This message is generated automatically by the infrastructure provider.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-950/50 border-t border-slate-800 px-6 py-4">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                                <span>Cloud Infrastructure Services • Enterprise Division</span>
                                <span className="font-mono">{incidentId}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policy & Legal Footer */}
            <div className="relative border-t border-slate-800/50 bg-slate-950/80 px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    {/* Policy Links */}
                    <div className="flex flex-wrap justify-center gap-4 mb-4 text-xs">
                        <span className="text-slate-600 hover:text-slate-500 cursor-default">Terms of Service</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-600 hover:text-slate-500 cursor-default">Acceptable Use Policy</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-600 hover:text-slate-500 cursor-default">Service Level Agreement</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-600 hover:text-slate-500 cursor-default">Privacy Policy</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-600 hover:text-slate-500 cursor-default">DMCA Policy</span>
                    </div>

                    {/* Legal Text */}
                    <div className="text-center space-y-2">
                        <p className="text-slate-700 text-[10px] leading-relaxed max-w-3xl mx-auto">
                            This suspension notice is issued pursuant to Section 7.3 of the Master Service Agreement
                            and Section 4.2 of the Acceptable Use Policy. Account holders are entitled to submit
                            a dispute within 14 days of this notice. All services remain suspended pending resolution
                            of outstanding compliance matters. This action is taken in accordance with standard
                            operational procedures and applicable regulations.
                        </p>
                        <p className="text-slate-700 text-[10px] leading-relaxed max-w-3xl mx-auto" dir="rtl">
                            صدر إشعار التعليق هذا وفقاً للبند 7.3 من اتفاقية الخدمة الرئيسية والبند 4.2
                            من سياسة الاستخدام المقبول. يحق لأصحاب الحسابات تقديم اعتراض خلال 14 يوماً
                            من تاريخ هذا الإشعار. تظل جميع الخدمات معلقة ريثما يتم حل مسائل الامتثال المعلقة.
                        </p>
                    </div>

                    {/* Copyright & Compliance */}
                    <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] text-slate-700">
                        <span>© {new Date().getFullYear()} Cloud Infrastructure Services Ltd. All rights reserved.</span>
                        <div className="flex items-center gap-3">
                            <span>ISO 27001 Certified</span>
                            <span>•</span>
                            <span>SOC 2 Type II Compliant</span>
                            <span>•</span>
                            <span>GDPR Compliant</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MaintenanceScreen;
