interface LogoProps {
  className?: string;
  inverted?: boolean;
}

export default function Logo({ className = 'h-10 w-auto', inverted = false }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="SL"
      className={className}
      style={inverted ? { filter: 'invert(1) brightness(2)', opacity: 0.7 } : undefined}
    />
  );
}
