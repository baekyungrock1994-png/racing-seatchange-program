// src/components/StudentHUD.tsx
'use client';

import React from 'react';
import { Player } from '@/types/game';
import { Smartphone, Laptop, Zap, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { CHARACTERS } from '@/constants/characters';

interface StudentHUDProps {
  player: Player;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  speed: number;
}

export function StudentHUD({
  player,
  isMobileMode,
  onToggleMobileMode,
  speed
}: StudentHUDProps) {
  const character = CHARACTERS[player.characterId] || CHARACTERS.speed_racer;
  const now = Date.now();
  const hasActiveEffect = player.activeEffect && player.effectEndTime > now;

  return (
    <>
      {/* 상단 정보 및 휴대폰 버전 토글 바 */}
      <header className="fixed top-0 inset-x-0 p-3 pointer-events-none flex items-start justify-between z-30">
        {/* 내 프로필 카드 */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center overflow-hidden">
            <img src={character.imageSrc} alt={character.name} className="w-full h-full object-contain" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {player.number}번
              </span>
              <h2 className="text-sm font-black text-white">{player.name}</h2>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{character.name}</p>
          </div>
        </div>

        {/* 조작 모드 토글 (크롬북 키보드 vs 휴대폰 버전) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onToggleMobileMode}
            className={`px-3.5 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
              isMobileMode
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/30'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
          >
            {isMobileMode ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
            {isMobileMode ? '📱 휴대폰 터치 켜짐' : '⌨️ 휴대폰 버전 켜기'}
          </button>
        </div>
      </header>

      {/* 중앙 하단: 활성 아이템/디버프 안내 배너 */}
      {hasActiveEffect && (
        <div className="fixed top-16 inset-x-0 flex justify-center pointer-events-none z-30 animate-bounce">
          {player.activeEffect === 'confuse' && (
            <div className="bg-fuchsia-600/95 text-white px-5 py-2.5 rounded-2xl border border-fuchsia-400 font-black text-sm flex items-center gap-2 shadow-2xl shadow-fuchsia-500/40">
              <AlertCircle className="w-5 h-5 animate-spin" />
              <span>💫 멘붕 혼란! 3초간 좌우 방향키가 반대로 작동합니다!</span>
            </div>
          )}

          {player.activeEffect === 'booster' && (
            <div className="bg-cyan-600/95 text-white px-5 py-2.5 rounded-2xl border border-cyan-400 font-black text-sm flex items-center gap-2 shadow-2xl shadow-cyan-500/40">
              <Zap className="w-5 h-5" />
              <span>🚀 터보 부스터 발동! 최고 속도 폭발!</span>
            </div>
          )}

          {player.activeEffect === 'shield' && (
            <div className="bg-emerald-600/95 text-white px-5 py-2.5 rounded-2xl border border-emerald-400 font-black text-sm flex items-center gap-2 shadow-2xl shadow-emerald-500/40">
              <ShieldCheck className="w-5 h-5" />
              <span>🛡️ 쉴드 작동! 충돌 1회 방어 중!</span>
            </div>
          )}
        </div>
      )}

      {/* 착석 완료 축하 오버레이 */}
      {player.isSeated && (
        <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 text-center max-w-sm mx-4 shadow-2xl shadow-emerald-500/30 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-white mb-1">착석 완료! 🎉</h3>
            <p className="text-emerald-400 font-bold text-sm mb-3">
              {player.number}번 {player.name} 학생의 자리가 확정되었습니다!
            </p>
            <p className="text-xs text-slate-400">
              다른 친구들이 도착할 때까지 잠시만 기다려 주세요.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
