import * as React from "react"
import { NumericFormat, NumericFormatProps } from "react-number-format"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps extends Omit<NumericFormatProps, "onChange"> {
    onChange?: (value: number | undefined) => void
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ className, onChange, ...props }, ref) => {
        return (
            <NumericFormat
                getInputRef={ref}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                onValueChange={(values) => {
                    if (onChange) {
                        onChange(values.floatValue)
                    }
                }}
                data-slot="input"
                className={cn(
                    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                    className
                )}
                {...props}
            />
        )
    }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
