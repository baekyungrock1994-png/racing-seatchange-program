// src/components/TeacherNotificationFeed.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameRoom, SeatDuel } from '@/types/game';
import { Dices, CheckCircle2, Trophy, Bell, ChevronRight, X } from 'lucide-react';

export interface FeedEvent {
  id: string;
  type: 'duel_start' | 'duel_winner' | 'seated';
  title: string;
  description: string;
  timestamp: Date;
  badgeColor: string;
}

interface TeacherNotificationFeedProps {
  room: GameRoom;
}

export function TeacherNotificationFeed({ room }: TeacherNotificationFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  const seenDuelsRef = useRef<Set<string>>(new Set());
  const seenSeatedPlayersRef = useRef<Set<string>>(new Set());
  const lastStatusRef = useRef(room.status);

  // 대기실 리셋 시 알림 목록 초기화
  useEffect(() => {
    if (room.status === 'LOBBY' && lastStatusRef.current !== 'LOBBY') {
      setEvents([]);
      seenDuelsRef.current.clear();
      seenSeatedPlayersRef.current.clear();
    }
    lastStatusRef.current = room.status;
  }, [room.status]);

  // 1. 주사위 대결 발생 실시간 감지
  useEffect(() => {
    const duel = room.activeDuel;
    if (!duel) return;

    if (!seenDuelsRef.current.has(duel.id)) {
      seenDuelsRef.current.add(duel.id);

      const newDuelEvent: FeedEvent = {
        id: `duel_${duel.id}`,
        type: 'duel_start',
        title: `🎲 [자리 쟁탈] ${duel.player1.name}(${duel.player1.number}번) VS ${duel.player2.name}(${duel.player2.number}번)`,
        description: `${duel.seatName}을(를) 두고 주사위 대결이 시작되었습니다!`,
        timestamp: new Date(),
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      };

      setEvents(prev => [newDuelEvent, ...prev.slice(0, 19)]); // 최대 20개 유지
    }
  }, [room.activeDuel]);

  // 2. 학생 착석 완료 실시간 감지
  useEffect(() => {
    if (room.status !== 'RACING' && room.status !== 'FINISHED') return;

    const currentPlayers = Object.values(room.players || {});
    const newSeatedEvents: FeedEvent[] = [];

    currentPlayers.forEach((p) => {
      if (p.isSeated && p.seatedId) {
        if (!seenSeatedPlayersRef.current.has(p.id)) {
          seenSeatedPlayersRef.current.add(p.id);

          const seat = room.seatConfig?.seats?.[p.seatedId];
          const seatName = seat
            ? `${seat.row + 1}분단 ${seat.col + 1}열`
            : p.seatedId.replace('seat_', '').replace('_', '분단 ') + '열';

          newSeatedEvents.push({
            id: `seated_${p.id}_${Date.now()}`,
            type: 'seated',
            title: `🪑 [착석 완료] ${p.name}(${p.number}번)`,
            description: `${seatName} 좌석에 안전하게 안착했습니다.`,
            timestamp: new Date(),
            badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
          });
        }
      } else {
        // 혹시 대결 패배 등으로 좌석이 풀린 경우 다시 착석할 수 있도록 추적 해제
        if (seenSeatedPlayersRef.current.has(p.id)) {
          seenSeatedPlayersRef.current.delete(p.id);
        }
      }
    });

    if (newSeatedEvents.length > 0) {
      setEvents(prev => [...newSeatedEvents, ...prev].slice(0, 20));
    }
  }, [room.players, room.seatConfig, room.status]);

  if (room.status === 'LOBBY' || events.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-24 z-30 w-80 sm:w-96 flex flex-col items-end pointer-events-none">
      {/* 알림 피드 패널 접기/펼치기 토글 */}
      <div className="pointer-events-auto mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 shadow-lg transition"
        >
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span>실시간 알림 ({events.length})</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* 실시간 알림 목록 */}
      {isOpen && (
        <div className="pointer-events-auto w-full flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          {events.slice(0, 8).map((evt) => (
            <div
              key={evt.id}
              className="bg-slate-900/95 backdrop-blur-md border border-slate-800 hover:border-slate-700 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-right-4 fade-in duration-200 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${evt.badgeColor}`}>
                  {evt.title}
                </span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {evt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium pl-1 leading-snug">
                {evt.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
