interface SectionEyebrowProps {
  children: React.ReactNode;
  light?: boolean;
}

export default function SectionEyebrow({ children, light = false }: SectionEyebrowProps) {
  return (
    <p
      className={`text-[0.7rem] tracking-[0.22em] uppercase flex items-center gap-3 mb-4 ${
        light ? 'text-green-soft' : 'text-green-deep'
      }`}
    >
      <span
        className={`block w-6 h-px ${light ? 'bg-green-soft' : 'bg-green-deep'}`}
      />
      {children}
    </p>
  );
}
