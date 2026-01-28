import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Car, Printer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JobOrderPrint } from '@/components/print';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared';
import { useRealtime } from '@/hooks';
import {
    AddJobItemModal,
    AddJobTaskModal,
    AssignTechniciansModal,
    EditJobItemModal,
    EditJobTaskModal,
    JobOrderHeader,
    JobOrderStatusBar,
    JobTasksSection,
    JobItemsSection,
    JobDetailsSection,
    JobSidebar,
    JobInvoiceCard,
    type JobOrderDetails,
    type JobItem,
    type JobTask,
    type AssignedTech,
    type LinkedInvoice,
} from '@/components/workshop';
import { jobOrderService } from '@/lib/services/operations/job-order.service';
import type { JobStatus } from '@/types/enums';

// ============================================================
// Job Order Details Page - Refactored
// ============================================================

export function JobOrderDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Modal states
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showAssignTechModal, setShowAssignTechModal] = useState(false);
    const [showEditItemModal, setShowEditItemModal] = useState(false);
    const [showEditTaskModal, setShowEditTaskModal] = useState(false);
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState<{ action: string; status: JobStatus } | null>(null);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [mileageOut, setMileageOut] = useState('');
    const [instructionsText, setInstructionsText] = useState('');
    const [editingItem, setEditingItem] = useState<JobItem | null>(null);
    const [editingTask, setEditingTask] = useState<JobTask | null>(null);

    // Print ref
    const printRef = useRef<HTMLDivElement>(null);

    // ============================================================
    // Data Fetching
    // ============================================================

    // Fetch job order details
    const { data: jobOrder, isLoading, error, refetch } = useQuery({
        queryKey: ['job-order', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_orders')
                .select(`
                    id, code, job_category, status, priority,
                    created_at, started_at, completed_at,
                    estimated_hours, actual_hours, notes, manager_instructions,
                    vehicle:vehicles (id, plate_number, make, model, year, color, vin),
                    customer:customers (id, name, phone, email),
                    assessment:assessments (id, mileage_in, fuel_level, customer_complaint)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                ...data,
                vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] || null : data.vehicle,
                customer: Array.isArray(data.customer) ? data.customer[0] || null : data.customer,
                assessment: Array.isArray(data.assessment) ? data.assessment[0] || null : data.assessment,
            } as JobOrderDetails;
        },
        enabled: !!id,
    });

    // Fetch assigned technicians
    const { data: assignedTechs } = useQuery({
        queryKey: ['job-technicians', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_technicians')
                .select(`
                    id, technician_id, is_lead,
                    technician:profiles (id, full_name, avatar_url)
                `)
                .eq('job_order_id', id);

            if (error) throw error;
            return data.map(d => ({
                ...d,
                technician: Array.isArray(d.technician) ? d.technician[0] : d.technician
            })) as AssignedTech[];
        },
        enabled: !!id,
    });

    // Fetch job items
    const { data: jobItems } = useQuery({
        queryKey: ['job-items', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_items')
                .select('*')
                .eq('job_order_id', id)
                .order('created_at');

            if (error) throw error;
            return data as JobItem[];
        },
        enabled: !!id,
    });

    // Fetch job tasks
    const { data: jobTasks } = useQuery({
        queryKey: ['job-tasks', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_tasks')
                .select(`
                    id, description, is_completed, is_blocked, blocked_reason,
                    completed_at, notes, sort_order, created_at,
                    assigned_to:profiles!job_tasks_assigned_to_fkey (id, full_name)
                `)
                .eq('job_order_id', id)
                .order('sort_order')
                .order('created_at');

            if (error) throw error;
            return data.map(task => ({
                ...task,
                assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to[0] || null : task.assigned_to
            })) as JobTask[];
        },
        enabled: !!id,
    });

    // Fetch linked invoice
    const { data: linkedInvoice } = useQuery({
        queryKey: ['job-invoice', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('id, code, status, total_amount, paid_amount')
                .eq('job_order_id', id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            return data as LinkedInvoice | null;
        },
        enabled: !!id,
    });

    // ============================================================
    // Real-time Subscriptions
    // ============================================================

    useRealtime({
        table: 'job_orders',
        filter: id ? `id=eq.${id}` : undefined,
        queryKey: ['job-order', id],
        enabled: !!id,
    });
    useRealtime({
        table: 'job_items',
        filter: id ? `job_order_id=eq.${id}` : undefined,
        queryKey: ['job-items', id],
        enabled: !!id,
    });
    useRealtime({
        table: 'job_tasks',
        filter: id ? `job_order_id=eq.${id}` : undefined,
        queryKey: ['job-tasks', id],
        enabled: !!id,
    });
    useRealtime({
        table: 'job_technicians',
        filter: id ? `job_order_id=eq.${id}` : undefined,
        queryKey: ['job-technicians', id],
        enabled: !!id,
    });

    // ============================================================
    // Mutations
    // ============================================================

    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const { error } = await supabase.from('job_items').delete().eq('id', itemId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-items', id] }),
    });

    const deleteTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-tasks', id] }),
    });

    const toggleTaskMutation = useMutation({
        mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
            const { error } = await supabase
                .from('job_tasks')
                .update({
                    is_completed: isCompleted,
                    completed_at: isCompleted ? new Date().toISOString() : null,
                })
                .eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-tasks', id] }),
    });

    const dispenseItemsMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            await jobOrderService.dispenseItems(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-items', id] });
            alert('تم صرف القطع بنجاح');
        },
        onError: (error: Error) => {
            console.error('Dispense error:', error);
            alert(error.message || 'فشل صرف القطع');
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: JobStatus) => {
            const updates: Record<string, any> = { status: newStatus };
            if (newStatus === 'in_progress' && !jobOrder?.started_at) {
                updates.started_at = new Date().toISOString();
            }
            if (newStatus === 'completed') {
                updates.completed_at = new Date().toISOString();
            }
            if (newStatus === 'delivered') {
                updates.delivered_at = new Date().toISOString();
            }
            const { error } = await supabase.from('job_orders').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-order', id] });
            setShowConfirmModal(null);
        },
        onError: (error: Error) => {
            alert(error.message || 'فشل تحديث الحالة');
        },
    });

    const updateInstructionsMutation = useMutation({
        mutationFn: async (instructions: string) => {
            const { error } = await supabase
                .from('job_orders')
                .update({ manager_instructions: instructions || null })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-order', id] });
            setShowInstructionsModal(false);
        },
    });

    // ============================================================
    // Handlers
    // ============================================================

    const handleStatusChange = (status: JobStatus) => {
        if (status === 'delivered') {
            setShowDeliveryModal(true);
        } else {
            setShowConfirmModal({ action: `تغيير الحالة إلى ${status}`, status });
        }
    };

    const handleCreateInvoice = () => {
        navigate(`/dashboard/finance/invoices/new?job_order_id=${id}`);
    };

    // Print handler
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `أمر-شغل-${jobOrder?.code || ''}`,
    });

    // ============================================================
    // Loading & Error States
    // ============================================================

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-20" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 lg:col-span-2" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (error || !jobOrder) {
        return (
            <Card className="border-destructive">
                <CardContent className="p-12 text-center">
                    <AlertCircle className="mx-auto mb-4 text-destructive" size={48} />
                    <h2 className="text-xl font-semibold mb-2">أمر الشغل غير موجود</h2>
                    <p className="text-muted-foreground mb-4">لم يتم العثور على أمر الشغل المطلوب</p>
                    <Button asChild>
                        <Link to="/dashboard/workshop">العودة للقائمة</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="space-y-4">
            {/* Breadcrumbs */}
            <PageHeader title="" showBreadcrumbs={true} className="pb-0" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <JobOrderHeader
                    code={jobOrder.code}
                    status={jobOrder.status}
                    priority={jobOrder.priority}
                    jobCategory={jobOrder.job_category}
                    createdAt={jobOrder.created_at}
                    linkedInvoice={linkedInvoice}
                    assignedTechs={assignedTechs}
                    hasItems={!!jobItems && jobItems.length > 0}
                    onRefresh={refetch}
                    onAssignTech={() => setShowAssignTechModal(true)}
                    onCreateInvoice={handleCreateInvoice}
                    onStatusChange={handleStatusChange}
                />

                {/* Print Button */}
                <Button
                    variant="outline"
                    onClick={() => handlePrint()}
                    className="gap-2"
                >
                    <Printer size={16} />
                    طباعة أمر الشغل
                </Button>
            </div>

            {/* Status Bar */}
            <div className="bg-card border rounded-xl p-4">
                <JobOrderStatusBar
                    currentStatus={jobOrder.status}
                    onStatusChange={handleStatusChange}
                    isUpdating={updateStatusMutation.isPending}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Area */}
                <div className="lg:col-span-2 space-y-4">
                    <Tabs defaultValue="tasks" className="w-full">
                        <div className="overflow-x-auto">
                            <TabsList className="grid w-full min-w-max grid-cols-3">
                                <TabsTrigger value="tasks">المهام</TabsTrigger>
                                <TabsTrigger value="items">البنود</TabsTrigger>
                                <TabsTrigger value="details">التفاصيل</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="tasks" className="mt-4">
                            <JobTasksSection
                                tasks={jobTasks || []}
                                onAddTask={() => setShowAddTaskModal(true)}
                                onEditTask={(task) => { setEditingTask(task); setShowEditTaskModal(true); }}
                                onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
                                onToggleTask={(taskId, isCompleted) => toggleTaskMutation.mutate({ taskId, isCompleted })}
                                isToggling={toggleTaskMutation.isPending}
                            />
                        </TabsContent>
                        <TabsContent value="items" className="mt-4">
                            <JobItemsSection
                                items={jobItems || []}
                                onAddItem={() => setShowAddItemModal(true)}
                                onEditItem={(item) => { setEditingItem(item); setShowEditItemModal(true); }}
                                onDeleteItem={(itemId) => deleteItemMutation.mutate(itemId)}
                                onDispense={() => dispenseItemsMutation.mutate()}
                                isDispensing={dispenseItemsMutation.isPending}
                            />
                        </TabsContent>
                        <TabsContent value="details" className="mt-4">
                            <JobDetailsSection
                                complaint={jobOrder.assessment?.customer_complaint || null}
                                instructions={jobOrder.manager_instructions}
                                onEditInstructions={() => {
                                    setInstructionsText(jobOrder.manager_instructions || '');
                                    setShowInstructionsModal(true);
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Invoice Card - First for visibility */}
                    <JobInvoiceCard
                        jobOrderId={id!}
                        linkedInvoice={linkedInvoice || null}
                        hasItems={!!jobItems && jobItems.length > 0}
                        itemsTotal={jobItems?.reduce((sum, item) => sum + item.total_price, 0) || 0}
                    />

                    <JobSidebar
                        jobOrderId={id!}
                        vehicle={jobOrder.vehicle}
                        customer={jobOrder.customer}
                    />
                </div>
            </div>

            {/* ============================================================ */}
            {/* Modals */}
            {/* ============================================================ */}

            {/* Add Item Modal */}
            {id && (
                <AddJobItemModal
                    open={showAddItemModal}
                    onOpenChange={setShowAddItemModal}
                    jobOrderId={id}
                />
            )}

            {/* Edit Item Modal */}
            {editingItem && id && (
                <EditJobItemModal
                    open={showEditItemModal}
                    onOpenChange={setShowEditItemModal}
                    item={editingItem}
                    jobOrderId={id}
                />
            )}

            {/* Add Task Modal */}
            {id && (
                <AddJobTaskModal
                    open={showAddTaskModal}
                    onOpenChange={setShowAddTaskModal}
                    jobOrderId={id}
                />
            )}

            {/* Edit Task Modal */}
            {editingTask && id && (
                <EditJobTaskModal
                    open={showEditTaskModal}
                    onOpenChange={setShowEditTaskModal}
                    task={editingTask}
                    jobOrderId={id}
                />
            )}

            {/* Assign Technicians Modal */}
            {id && (
                <AssignTechniciansModal
                    open={showAssignTechModal}
                    onOpenChange={setShowAssignTechModal}
                    jobOrderId={id}
                />
            )}

            {/* Instructions Modal */}
            <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>توجيهات المدير</DialogTitle>
                        <DialogDescription>
                            أضف أو عدّل التوجيهات للفنيين
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={instructionsText}
                        onChange={(e) => setInstructionsText(e.target.value)}
                        placeholder="اكتب التوجيهات هنا..."
                        rows={5}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowInstructionsModal(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => updateInstructionsMutation.mutate(instructionsText)}
                            disabled={updateInstructionsMutation.isPending}
                        >
                            حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Status Modal */}
            <Dialog open={!!showConfirmModal} onOpenChange={() => setShowConfirmModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تأكيد تغيير الحالة</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من {showConfirmModal?.action}؟
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmModal(null)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => showConfirmModal && updateStatusMutation.mutate(showConfirmModal.status)}
                            disabled={updateStatusMutation.isPending}
                        >
                            تأكيد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delivery Modal */}
            <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Car size={20} />
                            تسليم المركبة
                        </DialogTitle>
                        <DialogDescription>
                            أدخل عداد الكيلومتر عند التسليم (اختياري)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="mileage_out">عداد الكيلومترات عند الخروج</Label>
                        <Input
                            id="mileage_out"
                            type="number"
                            placeholder="مثال: 125000"
                            value={mileageOut}
                            onChange={(e) => setMileageOut(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeliveryModal(false)}>
                            إلغاء
                        </Button>
                        <Button
                            className="bg-teal-600 hover:bg-teal-700"
                            onClick={() => {
                                updateStatusMutation.mutate('delivered');
                                setShowDeliveryModal(false);
                            }}
                            disabled={updateStatusMutation.isPending}
                        >
                            <Car size={16} className="ml-2" />
                            تأكيد التسليم
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden Print Template */}
            <div style={{ display: 'none' }}>
                <JobOrderPrint
                    ref={printRef}
                    jobOrder={{
                        code: jobOrder.code,
                        status: jobOrder.status,
                        job_category: jobOrder.job_category,
                        priority: jobOrder.priority,
                        created_at: jobOrder.created_at,
                        started_at: jobOrder.started_at || undefined,
                        completed_at: jobOrder.completed_at || undefined,
                        notes: jobOrder.notes || undefined,
                        manager_instructions: jobOrder.manager_instructions || undefined,
                    }}
                    customer={jobOrder.customer ? {
                        name: jobOrder.customer.name,
                        phone: jobOrder.customer.phone || undefined,
                    } : undefined}
                    vehicle={jobOrder.vehicle ? {
                        plate_number: jobOrder.vehicle.plate_number,
                        make: jobOrder.vehicle.make || undefined,
                        model: jobOrder.vehicle.model || undefined,
                        year: jobOrder.vehicle.year || undefined,
                        color: jobOrder.vehicle.color || undefined,
                        vin: jobOrder.vehicle.vin || undefined,
                    } : undefined}
                    assessment={jobOrder.assessment ? {
                        mileage_in: jobOrder.assessment.mileage_in || undefined,
                        fuel_level: jobOrder.assessment.fuel_level || undefined,
                        customer_complaint: jobOrder.assessment.customer_complaint || undefined,
                    } : undefined}
                    items={(jobItems || []).map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total_price,
                        type: item.item_type === 'labor' || item.item_type === 'external' ? 'service' : 'part',
                    }))}
                    assignedTechs={(assignedTechs || []).map(t => ({
                        name: t.technician?.full_name || '',
                        is_lead: t.is_lead,
                    }))}
                />
            </div>
        </div>
    );
}
