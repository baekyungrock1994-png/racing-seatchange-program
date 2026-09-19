// src/app/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Users, Play, Sparkles, ChevronRight, Check } from 'lucide-react';
import { CHARACTERS, CHARACTER_LIST } from '@/constants/characters';
import { THEME_LIST } from '@/constants/themes';
import { CharacterId, Player } from '@/types/game';
import { SyncBridge } from '@/lib/syncBridge';

export default function HomePage() {
  const router = useRouter();

  // 학생 참가 폼 상태
  const [roomCode, setRoomCode] = useState('');
  const [studentNumber, setStudentNumber] = useState<number | ''>('');
  const [studentName, setStudentName] = useState('');
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>('speed_racer');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMsg('올바른 4~6자리 방 코드를 입력해주세요.');
      return;
    }
    if (!studentNumber || Number(studentNumber) <= 0) {
      setErrorMsg('출석 번호를 입력해주세요.');
      return;
    }
    if (!studentName.trim()) {
      setErrorMsg('학생 이름을 입력해주세요.');
      return;
    }

    setIsJoining(true);

    const playerId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPlayer: Player = {
      id: playerId,
      name: studentName.trim(),
      number: Number(studentNumber),
      characterId: selectedCharId,
      color: CHARACTERS[selectedCharId].themeColor,
      // 시작 좌표는 출발선(x: 230~340, y: 2450~2510) 3차선 트랙 내부 배치
      x: 230 + Math.random() * 110,
      y: 2460 + Math.random() * 50,
      vx: 0,
      vy: 0,
      angle: 0, // 북쪽을 바라보고 출발
      speed: 0,
      isSeated: false,
      seatedId: null,
      activeEffect: null,
      effectEndTime: 0,
      lastActive: Date.now()
    };

    try {
      await SyncBridge.joinPlayer(cleanCode, newPlayer);
      // 로컬 스토리지에 플레이어 세션 저장
      localStorage.setItem(`racing_player_${cleanCode}`, JSON.stringify(newPlayer));
      router.push(`/student?room=${cleanCode}&playerId=${playerId}`);
    } catch {
      setErrorMsg('방에 접속할 수 없습니다. 방 코드를 다시 확인해주세요.');
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 sm:p-8">
      {/* 상단 헤더 / 브랜드 */}
      <header className="w-full max-w-6xl flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Flag className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400">
              RACING SEAT
            </span>
            <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
              교실 자리바꾸기
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push('/teacher')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 text-amber-300 font-bold text-sm flex items-center gap-2 transition shadow-lg"
        >
          <Users className="w-4 h-4 text-amber-400" /> 교사 로그인 / 방 개설
        </button>
      </header>

      {/* 메인 히어로 섹션 */}
      <div className="w-full max-w-6xl my-6 flex flex-col lg:flex-row items-center justify-between gap-10">
        {/* 좌측: 타이틀 & 5종 캐릭터 쇼케이스 */}
        <div className="flex-1 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black mb-4">
            <Sparkles className="w-3.5 h-3.5" /> 교실 자리 바꾸기를 카트 레이싱 배틀로!
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            서킷을 질주하여<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-500">
              원하는 자리를 선점하라!
            </span>
          </h1>
          <p className="mt-4 text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
            복잡한 서킷의 장애물과 아이템을 뚫고 결승선 교실에 먼저 도착해 원하는 ㄷ자 책상에 주차하세요!
          </p>

          {/* 5종 카트 쇼케이스 바 */}
          <div className="mt-8 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 backdrop-blur-sm max-w-xl">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              🏎️ 5대 전용 레이싱 머신 라인업
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CHARACTER_LIST.map((char) => (
                <div
                  key={char.id}
                  className="flex flex-col items-center bg-slate-950/60 border border-slate-800 rounded-2xl p-2 group hover:border-slate-600 transition"
                >
                  <div className="w-12 h-16 flex items-center justify-center overflow-hidden">
                    <img
                      src={char.imageSrc}
                      alt={char.name}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 mt-1 truncate w-full text-center">
                    {char.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우측: 학생 참가 카드 */}
        <div className="w-full max-w-md bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
              🎮
            </div>
            <div>
              <h2 className="text-xl font-black text-white">학생 입장하기</h2>
              <p className="text-xs text-slate-400">선생님이 띄운 방 코드를 입력하세요</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">방 코드 (6자리)</label>
              <input
                type="text"
                placeholder="예: RACING"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono text-lg font-black tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-500"
                maxLength={8}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">출석 번호</label>
                <input
                  type="number"
                  placeholder="예: 7"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-base placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  min={1}
                  max={60}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">학생 이름</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-base placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            {/* 내 캐릭터 카트 선택 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">내 카트 선택</label>
              <div className="grid grid-cols-5 gap-2">
                {CHARACTER_LIST.map((char) => {
                  const isSelected = selectedCharId === char.id;
                  return (
                    <button
                      type="button"
                      key={char.id}
                      onClick={() => setSelectedCharId(char.id)}
                      className={`relative p-1.5 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/20 scale-105'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-10 h-14 flex items-center justify-center overflow-hidden">
                        <img src={char.imageSrc} alt={char.name} className="w-full h-full object-contain" />
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2 font-medium">
                선택: <span className="text-amber-400 font-bold">{CHARACTERS[selectedCharId].name}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isJoining}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Play className="w-5 h-5 fill-slate-950" /> 레이싱 참가하기
            </button>
          </form>
        </div>
      </div>

      {/* 하단 6종 테마 서킷 소개 */}
      <footer className="w-full max-w-6xl border-t border-slate-800/80 pt-6 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>6종 테마 서킷 지원:</span>
            {THEME_LIST.map((theme) => (
              <span key={theme.id} className="text-slate-400 font-medium">
                {theme.icon} {theme.name}
              </span>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            크롬북 키보드 조작 & 모바일 가상 조이스틱 완벽 지원
          </div>
        </div>
      </footer>
    </main>
  );
}
