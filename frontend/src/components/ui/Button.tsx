import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'error' | 'link';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: 'bg-primary text-white hover:bg-primary-light shadow-sm',
            secondary: 'bg-secondary text-white hover:bg-slate-700 shadow-sm',
            outline: 'border border-border bg-transparent hover:bg-muted text-foreground',
            ghost: 'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
            error: 'bg-error text-white hover:bg-red-600 shadow-sm',
            link: 'p-0 h-auto bg-transparent text-primary hover:underline font-bold',
        };

        const sizes = {
            sm: 'h-8 px-3 text-xs',
            md: 'h-10 px-4 py-2',
            lg: 'h-12 px-8 text-lg',
            icon: 'h-10 w-10 p-2',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        );
    }
)
Button.displayName = "Button"

export { Button }
