import { cn } from '../../utils/helpers';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({ icon, className, ...props }: InputProps) {
  return (
    <div className="qc-search-wrap">
      {icon && (
        <span className="qc-search-icon" aria-hidden>
          {icon}
        </span>
      )}
      <input
        className={cn('qc-search-input rounded-xl py-2.5 text-sm', icon ? 'pl-10 pr-3' : 'px-4', className)}
        {...props}
      />
    </div>
  );
}
