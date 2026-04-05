import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
};

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <section className={cn("page-stack", className)}>
      {backHref && backLabel ? (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="page-header">
        <div className="min-w-0 space-y-2">
          <h1 className={cn("page-title", titleClassName)}>{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div> : null}
      </div>
    </section>
  );
}
