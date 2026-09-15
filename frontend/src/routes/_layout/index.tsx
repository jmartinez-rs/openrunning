import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { AnalyticsService, SyncService } from "@/client";

import { WeekStrip, DayStatus } from "@/components/Dashboard/WeekStrip";
import { TodayRow } from "@/components/Dashboard/TodayRow";
import { StravaSyncBar } from "@/components/Dashboard/StravaSyncBar";
import { TargetRaceCard } from "@/components/Dashboard/TargetRaceCard";
import { VolumeCard } from "@/components/Dashboard/VolumeCard";
import { CoachCard } from "@/components/Dashboard/CoachCard";
import { ManualRunSheet } from "@/components/Sheets/ManualRunSheet";

export const Route = createFileRoute("/_layout/")({
  component: OpenRunningDashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - OpenRunning",
      },
    ],
  }),
});

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatDateIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function OpenRunningDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false);

  const baseMonday = useMemo(() => {
    const today = new Date();
    const monday = getMonday(today);
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const weekStartIso = formatDateIso(baseMonday);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", weekStartIso],
    queryFn: () => AnalyticsService.readDashboard({ weekStart: weekStartIso }),
  });

  const dashboard = dashboardQuery.data;

  const syncMutation = useMutation({
    mutationFn: () => SyncService.triggerSync({ provider: "strava" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const todayIso = formatDateIso(new Date());

  // Generate 7 day statuses for WeekStrip
  const days: DayStatus[] = useMemo(() => {
    const result: DayStatus[] = [];
    const timeline = dashboard?.timeline || [];
    const timelineMap = new Map(timeline.map((d) => [d.date, d]));

    for (let i = 0; i < 7; i++) {
      const current = new Date(baseMonday);
      current.setDate(baseMonday.getDate() + i);
      const iso = formatDateIso(current);
      const isToday = iso === todayIso;
      const dayData = timelineMap.get(iso);

      let status: DayStatus["status"] = "empty";
      if (dayData && dayData.activities && dayData.activities.length > 0) {
        status = "done";
      }

      result.push({
        dateIso: iso,
        dayName: DAYS_SHORT[current.getDay()],
        dayNumber: current.getDate(),
        isToday,
        status,
        workoutTitle: dayData?.activities?.[0]?.name || undefined,
      });
    }
    return result;
  }, [baseMonday, dashboard, todayIso]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "Esta semana";
    const sunday = new Date(baseMonday);
    sunday.setDate(baseMonday.getDate() + 6);
    return `${baseMonday.getDate()} ${baseMonday.toLocaleDateString("es-AR", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("es-AR", { month: "short" })}`;
  }, [baseMonday, weekOffset]);

  const kpis = dashboard?.kpis;
  const currentKm = (kpis?.cardio_distance_meters || 0) / 1000;
  const targetKm = 50.0;

  const upcomingRace = dashboard?.upcoming_race;
  const daysToRace = upcomingRace
    ? Math.max(
        0,
        Math.ceil(
          (new Date(upcomingRace.date).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 38;

  const handleManualRunSubmit = async (_data: any) => {
    // Refresh dashboard on submit
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ¡Hola, {user?.full_name?.split(" ")[0] || "Corredor"}! 👋
          </h1>
          <p className="text-xs text-slate-400 capitalize font-medium">
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/settings" })}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Strava Sync Bar */}
      <StravaSyncBar
        lastSyncText="Strava sincronizado · recien"
        isSyncing={syncMutation.isPending}
        onSyncStrava={() => syncMutation.mutate()}
        onOpenManualRun={() => setIsManualSheetOpen(true)}
      />

      {/* Week Strip & Today Row Card */}
      <div className="space-y-3">
        <WeekStrip
          days={days}
          weekLabel={weekLabel}
          onPrevWeek={() => setWeekOffset((w) => w - 1)}
          onNextWeek={() => setWeekOffset((w) => w + 1)}
          onSelectDay={() => setIsManualSheetOpen(true)}
        />

        <TodayRow
          sessionTitle="Rodaje Z2 (8K) + 4 Series de 100m"
          workoutType="easy_run"
          isCompleted={false}
          onAction={() => setIsManualSheetOpen(true)}
        />
      </div>

      {/* Target Race Countdown Card */}
      <TargetRaceCard
        raceName={upcomingRace?.event_name || "Media Maratón de Buenos Aires"}
        daysRemaining={daysToRace}
        dateText={
          upcomingRace?.date
            ? new Date(upcomingRace.date).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "24 Ago 2025"
        }
        distanceKm={upcomingRace?.distance_km || 21.1}
        targetTimeText="Sub-1:45:00"
        targetPaceText="4:58"
        onClick={() => navigate({ to: "/races" as any })}
      />

      {/* Weekly Volume & Streak Card */}
      <VolumeCard
        currentKm={currentKm}
        targetKm={targetKm}
        streakWeeks={12}
        completedSessions={kpis?.sessions || 3}
        plannedSessions={4}
        onOpenCalendar={() => {}}
      />

      {/* AI Coach Proposal Card */}
      <CoachCard
        title="Plan de descarga listo para la semana 6"
        subtitle="Sugerencia: reducir 3 km el rodaje del jueves"
        hasProposal={true}
        onReview={() => {}}
      />

      {/* Manual Run Bottom Sheet */}
      <ManualRunSheet
        isOpen={isManualSheetOpen}
        onClose={() => setIsManualSheetOpen(false)}
        onSubmit={handleManualRunSubmit}
      />
    </div>
  );
}
