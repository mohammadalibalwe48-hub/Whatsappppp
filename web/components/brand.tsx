import Link from "next/link";
import { cn } from "@/lib/utils";

function Mark() {
  return (
    <span aria-hidden="true" className="brand-mark">
      <i /><i /><i /><i /><i /><i /><i /><i />
    </span>
  );
}

export function Brand({ className, markClassName, href = "/", onClick }: { className?: string; markClassName?: string; href?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link href={href} onClick={onClick} className={cn("inline-flex w-fit items-center gap-2.5 font-semibold tracking-[-0.035em] text-foreground", className)}>
      <span className={cn("grid h-9 w-9 place-items-center", markClassName)}><Mark /></span>
      <span className="text-[17px]">OtpWave</span>
    </Link>
  );
}

export function BrandMark() {
  return <Mark />;
}
