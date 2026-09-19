// src/components/TeacherHUD.tsx
'use client';

import React, { useState } from 'react';
import { GameRoom } from '@/types/game';
import { THEMES } from '@/constants/themes';
import { Play, Flag, Users, Volume2, VolumeX, AlertTriangle, Trophy } from 'lucide-react';
import { SoundSystem } from '@/engine/SoundSystem';

interface TeacherHUDProps {
  room: GameRoom;
  onStartCountdown: () => void;
  onFinishRace: () => void;
  onViewResults: () => void;
}

export function TeacherHUD({
  room,
  onStartCountdown,
  onFinishRace,
  onViewResults
}: TeacherHUDProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

  const theme = THEMES[room.themeId] || THEMES.classic;
  const players = Object.values(room.players || {});
  const totalPlayers = players.length;
  const seatedPlayers = players.filter(p => p.isSeated);
  const unseatedCount = totalPlayers - seatedPlayers.length;

  const toggleSound = () => {
    const muted = SoundSystem.toggleMute();
    setIsMuted(muted);
  };

  return (
    <>
      {/* 상단 컨트롤 바 */}
      <header className="fixed top-0 inset-x-0 p-4 pointer-events-none flex items-start justify-between z-30">
        {/* 방 정보 및 서킷 테마 */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{theme.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white">{theme.name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  방 코드 {room.code}
                </span>
              </div>
              <p className="text-xs text-slate-400">교사 중계 화면 (마우스 휠로 줌/패닝 조작)</p>
            </div>
          </div>
        </div>

        {/* 경기 진행 현황판 & 액션 버튼 */}
        <div className="pointer-events-auto flex items-center gap-3">
          {/* 현황 요약 뱃지 */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Users className="w-4 h-4 text-cyan-400" />
              참가: <span className="text-white text-sm font-black">{totalPlayers}명</span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-1.5 text-emerald-400">
              착석 완료: <span className="text-emerald-300 text-sm font-black">{seatedPlayers.length}명</span>
            </div>
            {room.status === 'RACING' && (
              <>
                <div className="w-px h-4 bg-slate-800" />
                <div className="flex items-center gap-1.5 text-amber-400">
                  미착석: <span className="text-amber-300 text-sm font-black">{unseatedCount}명</span>
                </div>
              </>
            )}
          </div>

          {/* 소리 토글 */}
          <button
            onClick={toggleSound}
            className="w-11 h-11 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center transition shadow-lg"
            title={isMuted ? '소리 켜기' : '소리 끄기'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* 대기실 상태: START YOUR ENGINE! 버튼 */}
          {room.status === 'LOBBY' && (
            <button
              onClick={onStartCountdown}
              disabled={totalPlayers === 0}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:from-red-500 hover:to-yellow-300 disabled:opacity-40 text-slate-950 font-black text-base tracking-wider shadow-2xl shadow-red-500/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
            >
              <Play className="w-5 h-5 fill-slate-950" /> START YOUR ENGINE!
            </button>
          )}

          {/* 레이싱 진행 중: 교사 레이싱 종료 권한 버튼 */}
          {room.status === 'RACING' && (
            <button
              onClick={() => setShowConfirmFinish(true)}
              className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm tracking-wide shadow-2xl shadow-rose-600/40 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
            >
              <Flag className="w-4 h-4 fill-white" /> 레이싱 종료 (잔여석 자동배치)
            </button>
          )}

          {/* 레이스 종료 완료: 최종 결과표 보기 버튼 */}
          {room.status === 'FINISHED' && (
            <button
              onClick={onViewResults}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-2xl shadow-emerald-500/40 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
            >
              <Trophy className="w-4 h-4" /> 최종 자리배치표 보기
            </button>
          )}
        </div>
      </header>

      {/* 카운트다운 전광판 오버레이 */}
      {room.status === 'COUNTDOWN' && (
        <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="text-8xl md:text-9xl font-black text-amber-400 animate-bounce tracking-widest drop-shadow-[0_0_50px_rgba(245,158,11,0.8)]">
            {room.countdown > 0 ? room.countdown : 'GO!'}
          </div>
          <p className="text-xl font-bold text-slate-200 mt-4 tracking-widest">
            START YOUR ENGINE!
          </p>
        </div>
      )}

      {/* 레이싱 강제 종료 확인 모달 */}
      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black mb-2">레이싱을 종료하시겠습니까?</h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              고의로 늦게 오거나 아직 자리에 들어가지 못한 <strong className="text-amber-400">{unseatedCount}명</strong>의 학생들은 
              남아 있는 빈 좌석에 <strong className="text-white">무작위(Random)로 자동 배치</strong>됩니다.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirmFinish(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowConfirmFinish(false);
                  onFinishRace();
                }}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-600/40 transition"
              >
                종료 및 자동 배치
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
