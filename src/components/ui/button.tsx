import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium font-sans ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[hsl(212_29%_22%)] active:bg-[hsl(212_28%_20%)] disabled:bg-disabled disabled:text-disabled-foreground shadow-primary/20",
        primary: "bg-primary text-primary-foreground hover:bg-[hsl(212_29%_22%)] active:bg-[hsl(212_28%_20%)] disabled:bg-disabled disabled:text-disabled-foreground shadow-primary/20",
        secondary: "bg-transparent text-primary border-2 border-primary hover:bg-primary/10 active:bg-primary/20 disabled:bg-transparent disabled:text-primary/50 disabled:border-primary/50 shadow-none",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[hsl(3_58%_46%)] active:bg-[hsl(3_60%_42%)] disabled:bg-[hsl(0_0%_95%)] disabled:text-[hsl(3_30%_60%)] shadow-destructive/20",
        spotlight: "bg-accent text-accent-foreground hover:bg-[hsl(46_100%_61%)] active:bg-[hsl(47_90%_56%)] disabled:bg-[hsl(50_100%_85%)] disabled:text-[hsl(210_16%_66%)] disabled:border-[hsl(210_16%_66%)] border-2 border-primary shadow-accent/20",
        outline: "border-2 border-primary/20 bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary",
        ghost: "hover:bg-accent hover:text-accent-foreground shadow-none hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 px-4 py-2 text-xs",
        lg: "h-12 px-8 py-3 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
