import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const bottomSheetVariants = cva(
  "fixed z-50 flex h-auto flex-col border bg-background",
  {
    variants: {
      size: {
        default: "max-h-[80vh] md:max-w-md md:mx-auto md:inset-x-4 md:bottom-4 md:rounded-lg inset-x-0 bottom-0 rounded-t-[10px]",
        large: "max-h-[90vh] md:max-w-lg md:mx-auto md:inset-x-4 md:bottom-4 md:rounded-lg inset-x-0 bottom-0 rounded-t-[10px]", 
        full: "h-screen md:max-w-2xl md:mx-auto md:inset-x-4 md:top-4 md:bottom-4 md:rounded-lg inset-x-0 inset-y-0 rounded-none",
      }
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface BottomSheetProps 
  extends React.ComponentPropsWithoutRef<typeof Sheet>,
    VariantProps<typeof bottomSheetVariants> {
  size?: "default" | "large" | "full"
}

const BottomSheet = React.forwardRef<
  React.ElementRef<typeof Sheet>,
  BottomSheetProps
>(({ size, ...props }, ref) => (
  <Sheet {...props} />
))
BottomSheet.displayName = "BottomSheet"

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent> & VariantProps<typeof bottomSheetVariants>
>(({ className, size, children, ...props }, ref) => (
  <SheetContent
    ref={ref}
    side="bottom"
    className={cn(
      // Mobile: full-bleed width, pinned bottom, no horizontal overflow
      "!fixed !inset-x-0 !bottom-0 !left-0 !right-0 !w-full !max-w-full !border-t !p-0 !rounded-t-[10px] pb-[env(safe-area-inset-bottom)]",
      // Desktop: centered with max-width and margin via transform
      "md:!left-1/2 md:!right-auto md:!w-auto md:!max-w-md md:!-translate-x-1/2 md:!bottom-4 md:!rounded-lg md:!border md:!border-t",
      bottomSheetVariants({ size }),
      className
    )}
    {...props}
  >
    {children}
  </SheetContent>
))
BottomSheetContent.displayName = "BottomSheetContent"

const BottomSheetHeader = SheetHeader
const BottomSheetTitle = SheetTitle
const BottomSheetDescription = SheetDescription

export {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
}