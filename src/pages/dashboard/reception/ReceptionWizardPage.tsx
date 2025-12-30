import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { customerService, type CreateCustomerDTO } from '@/lib/services/crm/customer.service';
import { vehicleService, type CreateVehicleDTO } from '@/lib/services/crm/vehicle.service';
import { assessmentService, type CreateAssessmentDTO } from '@/lib/services/operations/assessment.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    EntryTypeSelector,
    CustomerVehicleStep,
    VehicleDetailsStep,
    Breadcrumbs,
} from '@/components/shared';
import type { EntryType } from '@/types/enums';
import type { Customer, Vehicle } from '@/types/database';

// ============================================================
// Improved Reception Wizard Page
// ============================================================
// Optimized UX with 4 streamlined steps:
// 1. Entry Type Selection
// 2. Customer + Vehicle (combined)
// 3. Vehicle Details (optional, can skip)
// 4. Diagnosis / Complaints
// ============================================================

interface WizardState {
    step: number;
    entryType: EntryType | null;
    customer: Customer | null;
    vehicle: Vehicle | null;
    vehicleDetails: {
        make?: string;
        model?: string;
        year?: string;
        color?: string;
        fuel_level?: number;
        mileage?: string;
    };
    customerComplaint: string;
    diagnosisNotes: string;
}

const initialState: WizardState = {
    step: 1,
    entryType: null,
    customer: null,
    vehicle: null,
    vehicleDetails: {
        fuel_level: 50,
    },
    customerComplaint: '',
    diagnosisNotes: '',
};

const STEP_TITLES = [
    'نوع الاستلام',
    'العميل والسيارة',
    'تفاصيل إضافية',
    'شكوى العميل',
];

export function ReceptionWizardPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { profile } = useAuth();

    const [state, setState] = useState<WizardState>(initialState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step navigation
    const goToStep = (step: number) => {
        setState((prev) => ({ ...prev, step }));
        setError(null);
    };

    const nextStep = () => goToStep(state.step + 1);
    const prevStep = () => goToStep(state.step - 1);

    // Entry type selection (Step 1)
    const handleEntryTypeSelect = (type: EntryType) => {
        setState((prev) => ({ ...prev, entryType: type }));
        nextStep();
    };

    // Customer change (Step 2)
    const handleCustomerChange = (customer: Customer | null) => {
        setState((prev) => ({ ...prev, customer }));
    };

    // Vehicle change (Step 2)
    const handleVehicleChange = (vehicle: Vehicle | null) => {
        setState((prev) => ({ ...prev, vehicle }));
    };

    // Add new customer
    const handleAddNewCustomer = async (name: string, phone: string): Promise<Customer> => {
        const customer = await customerService.create({
            name,
            phone,
            customer_type: 'individual',
            branch_id: profile?.branch_id || null,
        } as CreateCustomerDTO);

        queryClient.invalidateQueries({ queryKey: ['customers'] });
        return customer;
    };

    // Add new vehicle
    const handleAddNewVehicle = async (customerId: string, plateNumber: string): Promise<Vehicle> => {
        const vehicle = await vehicleService.create({
            customer_id: customerId,
            plate_number: plateNumber,
            make: 'غير محدد',
            model: 'غير محدد',
        } as CreateVehicleDTO);

        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        return vehicle;
    };

    // Vehicle details change (Step 3)
    const handleVehicleDetailsChange = (details: WizardState['vehicleDetails']) => {
        setState((prev) => ({ ...prev, vehicleDetails: details }));
    };

    // Handle proceed from Step 2
    const handleStep2Proceed = () => {
        if (!state.customer) {
            setError('يرجى اختيار عميل');
            return;
        }
        // For quick_check, skip vehicle requirement
        if (state.entryType !== 'quick_check' && !state.vehicle) {
            setError('يرجى اختيار مركبة');
            return;
        }
        nextStep();
    };

    // Handle skip details (Step 3)
    const handleSkipDetails = () => {
        goToStep(4);
    };

    // Handle final submission
    const handleSubmit = async () => {
        if (!state.customerComplaint.trim()) {
            setError('يرجى إدخال شكوى العميل');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Update vehicle with additional details if provided
            if (state.vehicle?.id && Object.keys(state.vehicleDetails).length > 1) {
                await vehicleService.update(state.vehicle.id, {
                    make: state.vehicleDetails.make || undefined,
                    model: state.vehicleDetails.model || undefined,
                    year: state.vehicleDetails.year ? parseInt(state.vehicleDetails.year) : undefined,
                    color: state.vehicleDetails.color || undefined,
                    current_mileage: state.vehicleDetails.mileage
                        ? parseInt(state.vehicleDetails.mileage)
                        : undefined,
                });
            }

            // Create assessment
            const assessmentData: CreateAssessmentDTO = {
                customer_id: state.customer!.id,
                vehicle_id: state.vehicle?.id || null,
                branch_id: profile?.branch_id || null,
                entry_type: state.entryType!,
                mileage_in: state.vehicleDetails.mileage
                    ? parseInt(state.vehicleDetails.mileage)
                    : undefined,
                fuel_level: state.vehicleDetails.fuel_level,
                customer_complaint: state.customerComplaint.trim(),
                initial_diagnosis: state.diagnosisNotes.trim() || undefined,
            };

            const assessment = await assessmentService.create(assessmentData);

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['assessments'] });
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });

            // Navigate to reception list
            navigate('/dashboard/reception');
        } catch (err) {
            console.error('Submission error:', err);
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Breadcrumbs */}
            <div className="max-w-lg mx-auto px-4 pt-4">
                <Breadcrumbs />
            </div>

            {/* Progress Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <div className="max-w-lg mx-auto px-4 py-3">
                    {/* Back button and title */}
                    <div className="flex items-center gap-3 mb-3">
                        {state.step > 1 && (
                            <Button variant="ghost" size="icon" onClick={prevStep}>
                                <ArrowRight size={20} />
                            </Button>
                        )}
                        <h1 className="text-lg font-bold flex-1">
                            {STEP_TITLES[state.step - 1]}
                        </h1>
                        <span className="text-sm text-muted-foreground">
                            {state.step} / 4
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map((step) => (
                            <div
                                key={step}
                                className={cn(
                                    "h-1 flex-1 rounded-full transition-all duration-300",
                                    step <= state.step ? "bg-primary" : "bg-muted"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 py-6">
                {/* Error Message */}
                {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4 text-center">
                        {error}
                    </div>
                )}

                {/* Step 1: Entry Type */}
                {state.step === 1 && (
                    <EntryTypeSelector
                        value={state.entryType}
                        onChange={handleEntryTypeSelect}
                    />
                )}

                {/* Step 2: Customer + Vehicle */}
                {state.step === 2 && (
                    <div className="space-y-4">
                        <CustomerVehicleStep
                            customerId={state.customer?.id || null}
                            vehicleId={state.vehicle?.id || null}
                            onCustomerChange={handleCustomerChange}
                            onVehicleChange={handleVehicleChange}
                            onAddNewCustomer={handleAddNewCustomer}
                            onAddNewVehicle={handleAddNewVehicle}
                        />

                        {/* Proceed Button */}
                        {state.customer && (state.entryType === 'quick_check' || state.vehicle) && (
                            <div className="pt-4">
                                <Button
                                    className="w-full h-12 text-base"
                                    onClick={handleStep2Proceed}
                                >
                                    التالي
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Vehicle Details (Optional) */}
                {state.step === 3 && (
                    <VehicleDetailsStep
                        values={state.vehicleDetails}
                        onChange={handleVehicleDetailsChange}
                        onSkip={handleSkipDetails}
                        onNext={nextStep}
                    />
                )}

                {/* Step 4: Diagnosis */}
                {state.step === 4 && (
                    <div className="space-y-6">
                        <div>
                            <Label htmlFor="complaint" className="text-base font-semibold mb-2 block">
                                شكوى العميل *
                            </Label>
                            <Textarea
                                id="complaint"
                                value={state.customerComplaint}
                                onChange={(e) => setState((prev) => ({
                                    ...prev,
                                    customerComplaint: e.target.value
                                }))}
                                placeholder="اكتب شكوى العميل بالتفصيل..."
                                className="min-h-[120px] text-base"
                                autoFocus
                            />
                        </div>

                        <div>
                            <Label htmlFor="diagnosis" className="text-base font-semibold mb-2 block">
                                ملاحظات التشخيص المبدئي (اختياري)
                            </Label>
                            <Textarea
                                id="diagnosis"
                                value={state.diagnosisNotes}
                                onChange={(e) => setState((prev) => ({
                                    ...prev,
                                    diagnosisNotes: e.target.value
                                }))}
                                placeholder="أي ملاحظات أولية من الفحص..."
                                className="min-h-[100px] text-base"
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            className="w-full h-14 text-lg gap-2 bg-green-600 hover:bg-green-700"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !state.customerComplaint.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    جاري الحفظ...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={22} />
                                    تأكيد الاستلام
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReceptionWizardPage;
