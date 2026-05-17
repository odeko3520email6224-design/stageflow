import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export function ResponsiveSelect({
  value,
  onValueChange,
  placeholder,
  options,
  label,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {options.find((opt) => opt.value === value)?.label || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onValueChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full py-3 px-4 rounded-lg text-left transition-colors select-none ${
                    value === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">
                  キャンセル
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="select-none">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.filter((option) => option.value !== "").map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}