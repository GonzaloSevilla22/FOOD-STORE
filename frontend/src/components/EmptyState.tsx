interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; to: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-xl border border-orange-100 bg-white/90 p-10 text-center shadow-sm dark:border-gray-500 dark:bg-gray-800/90">
      {icon && <div className="mb-4 text-5xl">{icon}</div>}
      <h3 className="text-xl font-bold text-orange-950 dark:text-orange-200">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">{description}</p>}
      {action && (
        <a
          href={action.to}
          className="mt-6 inline-block rounded-lg bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
