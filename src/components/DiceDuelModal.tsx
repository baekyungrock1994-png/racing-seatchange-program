// src/components/DiceDuelModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { SeatDuel } from '@/types/game';
import { CHARACTERS } from '@/constants/characters';
import { SoundSystem } from '@/engine/SoundSystem';
import confetti from 'canvas-confetti';
import { Dices, Trophy, Zap, AlertCircle } from 'lucide-react';

interface DiceDuelModalProps {
  duel: SeatDuel;
  currentUserId?: string;
  onComplete?: () => void;
}

// 1~6 주사위 눈금 렌더러
function DiceFace({ value, isRolling }: { value: number; isRolling: boolean }) {
  // 주사위 눈금 도트 배치 패턴
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  const activeDots = dots[value] || [4];

  return (
    <div
      className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-white to-slate-200 border-4 border-slate-300 shadow-2xl p-3 grid grid-cols-3 grid-rows-3 gap-1.5 transition-transform duration-100 ${
        isRolling ? 'animate-bounce scale-105 rotate-6' : 'scale-100 rotate-0 ring-4 ring-amber-400/80 shadow-amber-500/30'
      }`}
    >
      {[...Array(9)].map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {activeDots.includes(i) && (
            <div
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${
                value === 1 ? 'bg-red-600 scale-125' : 'bg-slate-900'
              } shadow-inner`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function DiceDuelModal({ duel, currentUserId, onComplete }: DiceDuelModalProps) {
  const [isRolling, setIsRolling] = useState(true);
  const [displayRoll1, setDisplayRoll1] = useState(1);
  const [displayRoll2, setDisplayRoll2] = useState(1);
  const [revealed, setRevealed] = useState(false);

  const p1 = duel.player1;
  const p2 = duel.player2;
  const p1Meta = CHARACTERS[p1.characterId];
  const p2Meta = CHARACTERS[p2.characterId];

  const isCurrentUserWinner = currentUserId === duel.winnerId;

  useEffect(() => {
    // 1. 주사위 효과음 재생
    SoundSystem.playDiceRoll();

    // 2. 굴러가는 숫자 애니메이션 인터벌
    const rollInterval = setInterval(() => {
      setDisplayRoll1(Math.floor(Math.random() * 6) + 1);
      setDisplayRoll2(Math.floor(Math.random() * 6) + 1);
    }, 90);

    // 3. 2.2초 후 주사위 결과 확정 및 공개
    const revealTimer = setTimeout(() => {
      clearInterval(rollInterval);
      setIsRolling(false);
      setDisplayRoll1(p1.roll || 1);
      setDisplayRoll2(p2.roll || 1);
      setRevealed(true);

      SoundSystem.playDiceWin();
      if (isCurrentUserWinner) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, 2200);

    // 4. 3.8초 후 모달 자동 완료 및 닫힘
    const closeTimer = setTimeout(() => {
      onComplete?.();
    }, 3800);

    return () => {
      clearInterval(rollInterval);
      clearTimeout(revealTimer);
      clearTimeout(closeTimer);
    };
  }, [duel, isCurrentUserWinner, onComplete, p1.roll, p2.roll]);

  const winnerName = duel.winnerId === p1.id ? p1.name : p2.name;
  const loserName = duel.loserId === p1.id ? p1.name : p2.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-center overflow-hidden">
        {/* 네온 배경 장식 */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* 상단 타이틀 배지 */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs sm:text-sm font-black mb-4">
          <Dices className="w-4 h-4 animate-spin" />
          <span>동시 진입 감지! 자리 쟁탈전 주사위 대결</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
          {duel.seatName}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">
          두 선수가 동시에 도착했습니다! 더 높은 주사위 눈금을 뽑은 선수가 자리를 차지합니다.
        </p>

        {/* 대결 영역 (Player 1 vs Player 2) */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
          {/* Player 1 카드 */}
          <div
            className={`flex-1 flex flex-col items-center p-4 rounded-2xl border transition-all duration-300 ${
              revealed && duel.winnerId === p1.id
                ? 'bg-amber-500/10 border-amber-400 scale-105 shadow-lg shadow-amber-500/20'
                : revealed && duel.loserId === p1.id
                ? 'bg-slate-800/40 border-slate-700 opacity-60'
                : 'bg-slate-800/80 border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center p-1.5 mb-2">
              <img
                src={p1Meta?.imageSrc || '/assets/carts/speed_racer.png'}
                alt={p1.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-sm sm:text-base font-black text-white truncate max-w-[110px]">
              {p1.name}
            </div>
            <div className="text-xs text-slate-400 mb-3">{p1.number}번</div>
            <DiceFace value={displayRoll1} isRolling={isRolling} />
          </div>

          {/* VS 텍스트 배지 */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-rose-500/30">
              VS
            </div>
          </div>

          {/* Player 2 카드 */}
          <div
            className={`flex-1 flex flex-col items-center p-4 rounded-2xl border transition-all duration-300 ${
              revealed && duel.winnerId === p2.id
                ? 'bg-amber-500/10 border-amber-400 scale-105 shadow-lg shadow-amber-500/20'
                : revealed && duel.loserId === p2.id
                ? 'bg-slate-800/40 border-slate-700 opacity-60'
                : 'bg-slate-800/80 border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center p-1.5 mb-2">
              <img
                src={p2Meta?.imageSrc || '/assets/carts/cosmo_rider.png'}
                alt={p2.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-sm sm:text-base font-black text-white truncate max-w-[110px]">
              {p2.name}
            </div>
            <div className="text-xs text-slate-400 mb-3">{p2.number}번</div>
            <DiceFace value={displayRoll2} isRolling={isRolling} />
          </div>
        </div>

        {/* 결과 발표 배너 */}
        <div className="min-h-[64px] flex items-center justify-center">
          {isRolling ? (
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base animate-pulse">
              <Zap className="w-5 h-5 animate-bounce" />
              <span>주사위를 신나게 굴리고 있습니다...!</span>
            </div>
          ) : (
            <div className="space-y-1.5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black text-amber-400">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>
                  {winnerName} 승리! ({Math.max(p1.roll || 0, p2.roll || 0)}점 vs {Math.min(p1.roll || 0, p2.roll || 0)}점)
                </span>
              </div>
              <div className="text-xs sm:text-sm text-cyan-300 font-medium flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-cyan-400" />
                <span>
                  {loserName} 선수는 상자 밖으로 이동하여 다른 빈자리를 찾아갑니다!
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
