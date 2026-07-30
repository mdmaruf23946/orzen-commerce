import { Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ComingSoonDialog({
  open,
  feature,
  onOpenChange,
}: {
  open: boolean;
  feature: string | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-2xl p-0">
        <div className="bg-gradient-to-b from-primary/12 to-transparent px-6 pb-6 pt-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary shadow-sm">
            <Rocket className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Coming Soon</h2>
          {feature && <p className="mt-1 text-sm font-medium text-primary">{feature}</p>}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This feature is under development and will be available in a future update.
          </p>
          <div className="mt-6 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                toast.success("We'll notify you when it launches");
                onOpenChange(false);
              }}
            >
              Notify Me
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
