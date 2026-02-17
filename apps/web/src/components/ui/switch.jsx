import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, onCheckedChange, checked, ...props }, ref) => {
    const [localChecked, setLocalChecked] = React.useState(props.defaultChecked || false);
    const isChecked = checked !== undefined ? checked : localChecked;

    const handleClick = (e) => {
        if (checked === undefined) {
            setLocalChecked(!isChecked);
        }
        onCheckedChange?.(!isChecked);
        props.onClick?.(e);
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isChecked}
            data-state={isChecked ? "checked" : "unchecked"}
            ref={ref}
            className={cn(
                "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600",
                className
            )}
            onClick={handleClick}
            {...props}
        >
            <span
                data-state={isChecked ? "checked" : "unchecked"}
                className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                )}
            />
        </button>
    );
})
Switch.displayName = "Switch"

export { Switch }
