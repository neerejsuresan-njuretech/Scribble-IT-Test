import React from 'react';
import { useITSM } from '../../context/ITSMContext';

// 5x7 Dot Matrix Font Map for Njure Tech dot-matrix minimal aesthetic
const FONT_MAP: Record<string, number[]> = {
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
  'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  '0': [0x0E, 0x13, 0x15, 0x11, 0x15, 0x19, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
  '3': [0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
  ':': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
};

interface DotMatrixTextProps {
  text: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  activeColor?: string;
  dimColor?: string;
  glow?: boolean;
  className?: string;
}

export const DotMatrixText: React.FC<DotMatrixTextProps> = ({
  text,
  size = 'md',
  activeColor,
  dimColor,
  glow = false,
  className = ''
}) => {
  const { theme } = useITSM();
  const isLight = theme === 'light';

  // Invert dot-matrix display colors cleanly in light mode
  const resolvedActiveColor =
    isLight && (!activeColor || activeColor === '#ffffff' || activeColor === '#fff' || activeColor === 'currentColor')
      ? '#0f172a'
      : activeColor || (isLight ? '#0f172a' : '#f8fafc');

  const resolvedDimColor =
    isLight && (!dimColor || dimColor === '#262626' || dimColor === 'rgba(120, 120, 120, 0.12)')
      ? 'rgba(15, 23, 42, 0.13)'
      : dimColor || (isLight ? 'rgba(15, 23, 42, 0.13)' : 'rgba(255, 255, 255, 0.1)');

  const useGlow = glow && !isLight;
  const chars = text.toUpperCase().split('');

  const dotRadius = size === 'xs' ? 1.1 : size === 'sm' ? 1.3 : size === 'md' ? 1.6 : 2.2;
  const colSpacing = size === 'xs' ? 3.2 : size === 'sm' ? 3.8 : size === 'md' ? 4.5 : 6;
  const rowSpacing = size === 'xs' ? 3.2 : size === 'sm' ? 3.8 : size === 'md' ? 4.5 : 6;
  const charSpacing = size === 'xs' ? 20 : size === 'sm' ? 24 : size === 'md' ? 28 : 38;

  const totalWidth = chars.length * charSpacing;
  const totalHeight = 7 * rowSpacing + 4;

  const maxHeightPx = size === 'xs' ? 14 : size === 'sm' ? 18 : size === 'md' ? 24 : 32;

  return (
    <span className={`inline-flex items-center select-none overflow-hidden max-w-full ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        preserveAspectRatio="xMinYMid meet"
        style={{ maxHeight: `${maxHeightPx}px`, width: `${totalWidth}px` }}
        className="max-w-full h-auto block"
        aria-label={text}
      >
        {useGlow && (
          <defs>
            <filter id={`glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        )}
        {chars.map((char, charIdx) => {
          const matrix = FONT_MAP[char] || FONT_MAP[' '];
          const offsetX = charIdx * charSpacing + 3;

          return (
            <g key={charIdx} transform={`translate(${offsetX}, 2)`}>
              {matrix.map((rowBits, rowIndex) => {
                const dots = [];
                for (let colIndex = 0; colIndex < 5; colIndex++) {
                  const bit = (rowBits >> (4 - colIndex)) & 1;
                  const cx = colIndex * colSpacing;
                  const cy = rowIndex * rowSpacing;

                  dots.push(
                    <circle
                      key={`${rowIndex}-${colIndex}`}
                      cx={cx}
                      cy={cy}
                      r={dotRadius}
                      fill={bit ? resolvedActiveColor : resolvedDimColor}
                      filter={useGlow && bit ? `url(#glow-${size})` : undefined}
                    />
                  );
                }
                return dots;
              })}
            </g>
          );
        })}
      </svg>
    </span>
  );
};

// Minimalist status indicator complying with Zero-Pill rule: clean unboxed text with subtle dot-matrix indicator
export const MinimalStatus: React.FC<{
  status: string;
  variant?: 'neutral' | 'red' | 'amber' | 'emerald' | 'blue';
}> = ({ status, variant = 'neutral' }) => {
  const colorMap = {
    neutral: 'text-neutral-400',
    red: 'text-rose-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    blue: 'text-sky-400'
  };

  const dotColor = {
    neutral: 'bg-neutral-500',
    red: 'bg-rose-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-sky-400'
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase ${colorMap[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-xs ${dotColor[variant]}`} />
      <span>{status.replace(/_/g, ' ')}</span>
    </div>
  );
};
