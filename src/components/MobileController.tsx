// src/components/MobileController.tsx
'use client';

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { ControlInput } from '@/engine/CartPhysics';

interface MobileControllerProps {
  onInputChange: (input: Partial<ControlInput>) => void;
  activeEffect: string | null;
}

export function MobileController({ onInputChange, activeEffect }: MobileControllerProps) {
  const handleTouchStart = (key: keyof ControlInput) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onInputChange({ [key]: true });
  };

  const handleTouchEnd = (key: keyof ControlInput) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onInputChange({ [key]: false });
  };

  const isConfused = activeEffect === 'confuse';

  return (
    <div className="fixed inset-x-0 bottom-0 pointer-events-none p-4 pb-6 flex items-end justify-between select-none z-40">
      {/* 좌측: 좌/우 방향키 패드 */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          onTouchStart={handleTouchStart('left')}
          onTouchEnd={handleTouchEnd('left')}
          onMouseDown={handleTouchStart('left')}
          onMouseUp={handleTouchEnd('left')}
          onMouseLeave={handleTouchEnd('left')}
          className={`w-20 h-20 rounded-2xl bg-slate-900/80 backdrop-blur-md border-2 active:scale-95 transition-all flex flex-col items-center justify-center shadow-2xl ${
            isConfused 
              ? 'border-fuchsia-500 text-fuchsia-400' 
              : 'border-cyan-500/50 text-cyan-400 active:bg-cyan-500/20'
          }`}
        >
          <ChevronLeft className="w-10 h-10" />
          <span className="text-[10px] font-bold tracking-wider">{isConfused ? '우(반전)' : '좌회전'}</span>
        </button>

        <button
          onTouchStart={handleTouchStart('right')}
          onTouchEnd={handleTouchEnd('right')}
          onMouseDown={handleTouchStart('right')}
          onMouseUp={handleTouchEnd('right')}
          onMouseLeave={handleTouchEnd('right')}
          className={`w-20 h-20 rounded-2xl bg-slate-900/80 backdrop-blur-md border-2 active:scale-95 transition-all flex flex-col items-center justify-center shadow-2xl ${
            isConfused 
              ? 'border-fuchsia-500 text-fuchsia-400' 
              : 'border-cyan-500/50 text-cyan-400 active:bg-cyan-500/20'
          }`}
        >
          <ChevronRight className="w-10 h-10" />
          <span className="text-[10px] font-bold tracking-wider">{isConfused ? '좌(반전)' : '우회전'}</span>
        </button>
      </div>

      {/* 우측: 가속 (액셀) & 감속/후진 (브레이크) 버튼 */}
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        {/* 액셀 (가속) */}
        <button
          onTouchStart={handleTouchStart('forward')}
          onTouchEnd={handleTouchEnd('forward')}
          onMouseDown={handleTouchStart('forward')}
          onMouseUp={handleTouchEnd('forward')}
          onMouseLeave={handleTouchEnd('forward')}
          className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 to-green-400 text-slate-950 font-black border-2 border-emerald-300 shadow-2xl shadow-emerald-500/40 active:scale-95 transition-all flex flex-col items-center justify-center"
        >
          <ChevronUp className="w-12 h-12 stroke-[3]" />
          <span className="text-xs font-black tracking-widest mt--1">가속 (GO)</span>
        </button>

        {/* 브레이크 / 후진 */}
        <button
          onTouchStart={handleTouchStart('backward')}
          onTouchEnd={handleTouchEnd('backward')}
          onMouseDown={handleTouchStart('backward')}
          onMouseUp={handleTouchEnd('backward')}
          onMouseLeave={handleTouchEnd('backward')}
          className="w-20 h-14 rounded-2xl bg-rose-950/80 backdrop-blur-md border-2 border-rose-500/60 text-rose-400 font-bold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-lg active:bg-rose-600/20"
        >
          <ChevronDown className="w-6 h-6" />
          <span className="text-xs">후진</span>
        </button>
      </div>
    </div>
  );
}
