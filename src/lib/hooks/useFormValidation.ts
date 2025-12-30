// ============================================================
// useFormValidation - Hook for Zod-powered form validation
// ============================================================

import { useState, useCallback } from 'react';
import { z } from 'zod';

interface FormState<T> {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isSubmitting: boolean;
}

interface UseFormValidationOptions<T extends z.ZodRawShape> {
    schema: z.ZodObject<T>;
    initialValues: z.infer<z.ZodObject<T>>;
    onSubmit: (values: z.infer<z.ZodObject<T>>) => Promise<void> | void;
}

export function useFormValidation<T extends z.ZodRawShape>({
    schema,
    initialValues,
    onSubmit,
}: UseFormValidationOptions<T>) {
    type FormValues = z.infer<z.ZodObject<T>>;

    const [state, setState] = useState<FormState<FormValues>>({
        values: initialValues,
        errors: {},
        touched: {},
        isValid: true,
        isSubmitting: false,
    });

    // Validate a single field
    const validateField = useCallback(
        (name: keyof FormValues, value: unknown): string | undefined => {
            try {
                // Use the full schema and only check the specific field
                const partialData = { [name]: value } as Partial<FormValues>;
                const partialSchema = schema.partial();
                partialSchema.parse(partialData);
                return undefined;
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return error.issues[0]?.message;
                }
                return 'قيمة غير صالحة';
            }
        },
        [schema]
    );

    // Validate all fields
    const validateAll = useCallback((): boolean => {
        const result = schema.safeParse(state.values);

        if (result.success) {
            setState(prev => ({ ...prev, errors: {}, isValid: true }));
            return true;
        }

        const errors: Partial<Record<keyof FormValues, string>> = {};
        for (const issue of result.error.issues) {
            const path = issue.path[0] as keyof FormValues;
            if (!errors[path]) {
                errors[path] = issue.message;
            }
        }

        setState(prev => ({ ...prev, errors, isValid: false }));
        return false;
    }, [schema, state.values]);

    // Set a field value
    const setValue = useCallback(
        (name: keyof FormValues, value: unknown) => {
            setState(prev => {
                const newValues = { ...prev.values, [name]: value };
                const error = validateField(name, value);
                const newErrors = { ...prev.errors };

                if (error) {
                    newErrors[name] = error;
                } else {
                    delete newErrors[name];
                }

                return {
                    ...prev,
                    values: newValues,
                    errors: newErrors,
                    isValid: Object.keys(newErrors).length === 0,
                };
            });
        },
        [validateField]
    );

    // Set multiple values at once
    const setValues = useCallback((values: Partial<FormValues>) => {
        setState(prev => ({
            ...prev,
            values: { ...prev.values, ...values },
        }));
    }, []);

    // Mark a field as touched
    const setTouched = useCallback((name: keyof FormValues, touched = true) => {
        setState(prev => ({
            ...prev,
            touched: { ...prev.touched, [name]: touched },
        }));
    }, []);

    // Handle input change
    const handleChange = useCallback(
        (name: keyof FormValues) => (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
        ) => {
            const { value, type } = e.target;
            let parsedValue: unknown = value;

            if (type === 'number') {
                parsedValue = value === '' ? null : Number(value);
            } else if (type === 'checkbox') {
                parsedValue = (e.target as HTMLInputElement).checked;
            }

            setValue(name, parsedValue);
        },
        [setValue]
    );

    // Handle blur
    const handleBlur = useCallback(
        (name: keyof FormValues) => () => {
            setTouched(name);
            validateField(name, state.values[name]);
        },
        [setTouched, validateField, state.values]
    );

    // Handle submit
    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            if (e) {
                e.preventDefault();
            }

            // Mark all fields as touched
            const allTouched: Partial<Record<keyof FormValues, boolean>> = {};
            for (const key in state.values) {
                allTouched[key as keyof FormValues] = true;
            }
            setState(prev => ({ ...prev, touched: allTouched }));

            // Validate all
            if (!validateAll()) {
                return;
            }

            // Submit
            setState(prev => ({ ...prev, isSubmitting: true }));
            try {
                await onSubmit(state.values);
            } finally {
                setState(prev => ({ ...prev, isSubmitting: false }));
            }
        },
        [validateAll, onSubmit, state.values]
    );

    // Reset form
    const reset = useCallback(() => {
        setState({
            values: initialValues,
            errors: {},
            touched: {},
            isValid: true,
            isSubmitting: false,
        });
    }, [initialValues]);

    // Get field props helper
    const getFieldProps = useCallback(
        (name: keyof FormValues) => ({
            name: name as string,
            value: state.values[name] ?? '',
            onChange: handleChange(name),
            onBlur: handleBlur(name),
        }),
        [state.values, handleChange, handleBlur]
    );

    // Get error for a field (only if touched)
    const getError = useCallback(
        (name: keyof FormValues): string | undefined => {
            if (state.touched[name]) {
                return state.errors[name];
            }
            return undefined;
        },
        [state.errors, state.touched]
    );

    return {
        values: state.values,
        errors: state.errors,
        touched: state.touched,
        isValid: state.isValid,
        isSubmitting: state.isSubmitting,
        setValue,
        setValues,
        setTouched,
        validateField,
        validateAll,
        handleChange,
        handleBlur,
        handleSubmit,
        reset,
        getFieldProps,
        getError,
    };
}

export default useFormValidation;
