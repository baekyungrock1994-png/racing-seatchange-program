// src/components/ResultBoard.tsx
'use client';

import React, { useEffect } from 'react';
import { GameRoom } from '@/types/game';
import { Trophy, Printer, ArrowLeft, Users, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CHARACTERS } from '@/constants/characters';

interface ResultBoardProps {
  room: GameRoom;
  onBackToLobby: () => void;
}

export function ResultBoard({ room, onBackToLobby }: ResultBoardProps) {
  useEffect(() => {
    // 팡파르 축하 콘페티
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  }, []);

  const seats = room.seatConfig?.seats || {};
  const rows = room.seatConfig?.rows || 5;
  const cols = room.seatConfig?.cols || 6;

  const players = Object.values(room.players || {});
  const seatedCount = players.filter(p => p.isSeated).length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 sm:p-10 flex flex-col items-center">
      {/* 상단 액션 바 (인쇄 시 숨김) */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-8 print:hidden">
        <button
          onClick={onBackToLobby}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-sm flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" /> 새 레이스 준비하기
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition"
          >
            <Printer className="w-4 h-4" /> 배치표 인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {/* 최종 자리배치표 메인 인쇄 영역 */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl print:bg-white print:text-black print:border-none print:p-0">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm mb-3">
            <Trophy className="w-4 h-4" /> 레이싱 교실 자리바꾸기 최종 결과
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white print:text-black">
            우리 반 자리 배치표
          </h1>
          <p className="text-sm text-slate-400 print:text-gray-600 mt-2">
            방 코드: {room.code} • 총 학생: {players.length}명 전원 착석 완료
          </p>
        </div>

        {/* 칠판 (앞 쪽) */}
        <div className="w-full max-w-md mx-auto h-12 rounded-xl bg-emerald-800 border-2 border-emerald-600 text-emerald-100 font-black text-base flex items-center justify-center tracking-widest shadow-inner mb-8 print:bg-gray-200 print:text-black print:border-gray-400">
          칠 판 (교탁 / 앞 쪽)
        </div>

        {/* 좌석 그리드 */}
        <div
          className="grid gap-4 max-w-4xl mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const seatId = `seat_${r}_${c}`;
              const seat = seats[seatId];

              if (!seat || !seat.active) {
                return (
                  <div
                    key={seatId}
                    className="h-24 sm:h-28 rounded-2xl border-2 border-dashed border-slate-800/60 print:border-gray-200 flex items-center justify-center text-xs text-slate-700 print:text-gray-300"
                  >
                    통로
                  </div>
                );
              }

              const charMeta = seat.characterId ? CHARACTERS[seat.characterId] : null;

              return (
                <div
                  key={seatId}
                  className="h-24 sm:h-28 rounded-2xl bg-slate-800/80 border-2 border-amber-500/40 print:bg-gray-50 print:border-black p-2.5 flex flex-col justify-between shadow-lg relative group"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-gray-600 font-bold">
                    <span>{r + 1}-{c + 1}</span>
                    {charMeta && (
                      <span className="text-xs">{charMeta.name.slice(0, 2)}</span>
                    )}
                  </div>

                  <div className="text-center my-auto">
                    {seat.studentName ? (
                      <>
                        <div className="text-xs sm:text-sm font-black text-amber-400 print:text-black">
                          {seat.studentNumber}번
                        </div>
                        <div className="text-sm sm:text-base font-black text-white print:text-black truncate">
                          {seat.studentName}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">빈 자리</span>
                    )}
                  </div>

                  <div className="w-full h-1 bg-amber-500/30 rounded-full" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
