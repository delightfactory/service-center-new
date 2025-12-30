import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ============================================================
// Egyptian Plate Input Component
// ============================================================
// Supports:
// - 3 letters + 4 numbers (أ ب ج 1234)
// - 3 letters + 3 numbers (أ ب ج 123)
// - 2 letters + 4 numbers (أ ب 1234)
// Features:
// - Auto-advance between fields
// - Long-press to clear
// - Arabic keyboard for letters
// - Numeric keyboard for numbers
// ============================================================

interface EgyptianPlateInputProps {
    value: string;
    onChange: (plate: string) => void;
    autoFocus?: boolean;
    error?: string;
    className?: string;
}

// Arabic letters commonly used in Egyptian plates
const ARABIC_LETTERS = 'أابتثجحخدذرزسشصضطظعغفقكلمنهوي';

export function EgyptianPlateInput({
    value,
    onChange,
    autoFocus = false,
    error,
    className,
}: EgyptianPlateInputProps) {
    // Parse existing value
    const parseValue = (val: string): { letters: string[]; numbers: string[] } => {
        const clean = val.replace(/[\s-]/g, '');
        const letters: string[] = [];
        const numbers: string[] = [];

        for (const char of clean) {
            if (ARABIC_LETTERS.includes(char)) {
                if (letters.length < 3) letters.push(char);
            } else if (/[0-9٠-٩]/.test(char)) {
                if (numbers.length < 4) numbers.push(convertToArabicNumber(char));
            }
        }

        // Pad arrays
        while (letters.length < 3) letters.push('');
        while (numbers.length < 4) numbers.push('');

        return { letters, numbers };
    };

    const { letters: initialLetters, numbers: initialNumbers } = parseValue(value);
    const [letters, setLetters] = useState<string[]>(initialLetters);
    const [numbers, setNumbers] = useState<string[]>(initialNumbers);

    const letterRefs = useRef<(HTMLInputElement | null)[]>([]);
    const numberRefs = useRef<(HTMLInputElement | null)[]>([]);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // Convert Western to Arabic numerals
    function convertToArabicNumber(char: string): string {
        const westernToArabic: Record<string, string> = {
            '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
            '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
        };
        return westernToArabic[char] || char;
    }

    // Update parent when values change
    useEffect(() => {
        const plateString = `${letters.join('')} ${numbers.join('')}`.trim();
        if (plateString !== value.replace(/[\s-]/g, ' ').trim()) {
            onChange(plateString);
        }
    }, [letters, numbers, onChange, value]);

    // Auto-focus first empty field
    useEffect(() => {
        if (autoFocus) {
            const firstEmptyLetter = letters.findIndex(l => !l);
            if (firstEmptyLetter !== -1) {
                letterRefs.current[firstEmptyLetter]?.focus();
            } else {
                const firstEmptyNumber = numbers.findIndex(n => !n);
                if (firstEmptyNumber !== -1) {
                    numberRefs.current[firstEmptyNumber]?.focus();
                }
            }
        }
    }, [autoFocus]);

    const handleLetterChange = useCallback((index: number, char: string) => {
        // Accept only Arabic letters
        const lastChar = char.slice(-1);

        if (!lastChar) {
            // Backspace
            const newLetters = [...letters];
            newLetters[index] = '';
            setLetters(newLetters);
            // Go back to previous
            if (index > 0) {
                letterRefs.current[index - 1]?.focus();
            }
            return;
        }

        if (ARABIC_LETTERS.includes(lastChar)) {
            const newLetters = [...letters];
            newLetters[index] = lastChar;
            setLetters(newLetters);

            // Auto-advance
            if (index < 2) {
                letterRefs.current[index + 1]?.focus();
            } else {
                // Move to numbers
                numberRefs.current[0]?.focus();
            }
        } else if (/[0-9٠-٩]/.test(lastChar)) {
            // User typed a number in letter field - skip to numbers
            numberRefs.current[0]?.focus();
            const newNumbers = [...numbers];
            newNumbers[0] = convertToArabicNumber(lastChar);
            setNumbers(newNumbers);
            numberRefs.current[1]?.focus();
        }
    }, [letters, numbers]);

    const handleNumberChange = useCallback((index: number, char: string) => {
        const lastChar = char.slice(-1);

        if (!lastChar) {
            // Backspace
            const newNumbers = [...numbers];
            newNumbers[index] = '';
            setNumbers(newNumbers);
            // Go back
            if (index > 0) {
                numberRefs.current[index - 1]?.focus();
            } else {
                // Go back to letters
                letterRefs.current[2]?.focus();
            }
            return;
        }

        if (/[0-9٠-٩]/.test(lastChar)) {
            const arabicChar = convertToArabicNumber(lastChar);
            const newNumbers = [...numbers];
            newNumbers[index] = arabicChar;
            setNumbers(newNumbers);

            // Auto-advance
            if (index < 3) {
                numberRefs.current[index + 1]?.focus();
            } else {
                // Complete - blur
                numberRefs.current[index]?.blur();
            }
        }
    }, [numbers]);

    const handleLongPressStart = useCallback((type: 'letter' | 'number', index: number) => {
        longPressTimer.current = setTimeout(() => {
            // Clear the field
            if (type === 'letter') {
                const newLetters = [...letters];
                newLetters[index] = '';
                setLetters(newLetters);
                letterRefs.current[index]?.focus();
            } else {
                const newNumbers = [...numbers];
                newNumbers[index] = '';
                setNumbers(newNumbers);
                numberRefs.current[index]?.focus();
            }
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500);
    }, [letters, numbers]);

    const handleLongPressEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const inputBaseClass = cn(
        "w-12 h-14 text-center text-2xl font-bold rounded-xl border-2",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
        "transition-all duration-200",
        "bg-card text-foreground",
        error ? "border-destructive" : "border-border"
    );

    return (
        <div className={cn("space-y-2", className)}>
            <label className="block text-sm font-medium text-muted-foreground text-center mb-3">
                رقم اللوحة
            </label>

            <div className="flex items-center justify-center gap-2 rtl">
                {/* Letters Section */}
                <div className="flex gap-1.5">
                    {letters.map((letter, index) => (
                        <input
                            key={`letter-${index}`}
                            ref={(el) => (letterRefs.current[index] = el)}
                            type="text"
                            inputMode="text"
                            value={letter}
                            onChange={(e) => handleLetterChange(index, e.target.value)}
                            onTouchStart={() => handleLongPressStart('letter', index)}
                            onTouchEnd={handleLongPressEnd}
                            onMouseDown={() => handleLongPressStart('letter', index)}
                            onMouseUp={handleLongPressEnd}
                            onMouseLeave={handleLongPressEnd}
                            className={cn(inputBaseClass, "text-primary")}
                            maxLength={2}
                            placeholder="ـ"
                            dir="rtl"
                        />
                    ))}
                </div>

                {/* Separator */}
                <span className="text-2xl text-muted-foreground font-bold mx-1">-</span>

                {/* Numbers Section */}
                <div className="flex gap-1.5">
                    {numbers.map((number, index) => (
                        <input
                            key={`number-${index}`}
                            ref={(el) => (numberRefs.current[index] = el)}
                            type="text"
                            inputMode="numeric"
                            value={number}
                            onChange={(e) => handleNumberChange(index, e.target.value)}
                            onTouchStart={() => handleLongPressStart('number', index)}
                            onTouchEnd={handleLongPressEnd}
                            onMouseDown={() => handleLongPressStart('number', index)}
                            onMouseUp={handleLongPressEnd}
                            onMouseLeave={handleLongPressEnd}
                            className={cn(inputBaseClass, "text-foreground")}
                            maxLength={2}
                            placeholder="٠"
                            dir="ltr"
                        />
                    ))}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-sm text-destructive text-center mt-2">{error}</p>
            )}

            {/* Hint */}
            <p className="text-xs text-muted-foreground text-center mt-2">
                اضغط مطولاً على أي خانة لمسحها
            </p>
        </div>
    );
}

export default EgyptianPlateInput;
