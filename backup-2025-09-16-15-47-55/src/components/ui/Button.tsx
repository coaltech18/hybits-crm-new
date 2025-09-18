import React from 'react';
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import Icon from '../AppIcon';
import { ButtonProps } from '@/types';

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90 hover:shadow-pronounced transition-smooth",
                destructive: "bg-destructive text-destructive-foreground shadow-subtle hover:bg-destructive/90 hover:shadow-pronounced transition-smooth",
                outline: "border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground transition-smooth",
                secondary: "bg-secondary text-secondary-foreground shadow-subtle hover:bg-secondary/80 hover:shadow-pronounced transition-smooth",
                ghost: "text-foreground hover:bg-muted hover:text-foreground transition-smooth",
                link: "text-primary underline-offset-4 hover:underline transition-smooth",
                success: "bg-success text-success-foreground shadow-subtle hover:bg-success/90 hover:shadow-pronounced transition-smooth",
                warning: "bg-warning text-warning-foreground shadow-subtle hover:bg-warning/90 hover:shadow-pronounced transition-smooth",
                danger: "bg-error text-error-foreground shadow-subtle hover:bg-error/90 hover:shadow-pronounced transition-smooth",
            },
            size: {
                default: "h-11 px-6 py-3",
                sm: "h-9 rounded-lg px-4 text-sm",
                lg: "h-13 rounded-xl px-10 text-lg",
                icon: "h-11 w-11 rounded-lg",
                xs: "h-8 rounded-md px-3 text-xs",
                xl: "h-14 rounded-xl px-12 text-xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
    className,
    variant,
    size,
    asChild = false,
    children,
    loading = false,
    iconName = null,
    iconPosition = 'left',
    iconSize = null,
    fullWidth = false,
    disabled = false,
    ...props
}, ref) => {
    const Comp = asChild ? Slot : "button";

    // Icon size mapping based on button size
    const iconSizeMap: Record<string, number> = {
        xs: 12,
        sm: 14,
        default: 16,
        lg: 18,
        xl: 20,
        icon: 16,
    };

    const calculatedIconSize = iconSize || iconSizeMap?.[size || 'default'] || 16;

    // Loading spinner
    const LoadingSpinner = () => (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );

    // Icon rendering
    const renderIcon = () => {
        if (!iconName) return null;

        return (
            <Icon
                name={iconName}
                size={calculatedIconSize}
                className={cn(
                    children && iconPosition === 'left' && "mr-2",
                    children && iconPosition === 'right' && "ml-2"
                )}
            />
        );
    };

    return (
        <Comp
            className={cn(
                buttonVariants({ variant, size, className }),
                fullWidth && "w-full"
            )}
            ref={ref}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <LoadingSpinner />}
            {iconName && iconPosition === 'left' && renderIcon()}
            {children}
            {iconName && iconPosition === 'right' && renderIcon()}
        </Comp>
    );
});

Button.displayName = "Button";

export default Button;
