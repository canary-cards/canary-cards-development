import { useState } from "react";
import { DynamicSvg } from "./DynamicSvg";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ExpandableChartProps {
  assetName: string;
  alt: string;
  className?: string;
}

export const ExpandableChart = ({ assetName, alt, className }: ExpandableChartProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className={className}>
          <DynamicSvg
            assetName={assetName}
            alt={alt}
            className="w-full h-auto"
          />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-auto">
        <DynamicSvg
          assetName={assetName}
          alt={`${alt} - expanded view`}
          className="w-full h-auto"
        />
      </DialogContent>
    </Dialog>
  );
};
