import { useState } from "react";
import { Expand } from "lucide-react";
import { DynamicSvg } from "./DynamicSvg";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpandableChartProps {
  assetName: string;
  alt: string;
  className?: string;
}

export const ExpandableChart = ({ assetName, alt, className }: ExpandableChartProps) => {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <div className={`${className} relative cursor-pointer group`}>
                <DynamicSvg
                  assetName={assetName}
                  alt={alt}
                  className="w-full h-auto"
                />
                {/* Persistent expand icon */}
                <div className="absolute top-4 right-4 bg-background/90 p-2 rounded-lg shadow-lg border border-border transition-all duration-200 group-hover:bg-accent group-hover:scale-110">
                  <Expand className="h-5 w-5 text-primary" />
                </div>
              </div>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to expand</p>
          </TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-auto">
          <DynamicSvg
            assetName={assetName}
            alt={`${alt} - expanded view`}
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
