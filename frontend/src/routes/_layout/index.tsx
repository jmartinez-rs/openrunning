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
import { StreakCard } from "@/components/Dashboard/StreakCard";
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
  const targetKm = dashboard?.previous_kpis ? Math.max(10, Math.round(dashboard.previous_kpis.cardio_distance_meters / 1000) + 5) : 50.0;

  const formatPace = (secondsPerKm?: number | null) => {
    if (!secondsPerKm) return undefined;
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const avgPaceText = formatPace(kpis?.cardio_avg_pace_seconds_per_km);

  const upcomingRace = dashboard?.upcoming_race;
  const daysToRace = upcomingRace
    ? Math.max(
        0,
        Math.ceil(
          (new Date(upcomingRace.date).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const targetTimeText = undefined;
  const targetPaceText = undefined;

  // 1. Strava Sync State
  const stravaSyncState = dashboard?.sync_state?.find(s => s.provider === "strava");
  let lastSyncText = "Strava sin configurar";
  if (stravaSyncState) {
    if (stravaSyncState.last_run_at) {
       const diffMin = Math.floor((new Date().getTime() - new Date(stravaSyncState.last_run_at).getTime()) / 60000);
       if (diffMin < 1) lastSyncText = "Strava sincronizado · recién";
       else if (diffMin < 60) lastSyncText = `Strava sincronizado · hace ${diffMin} min`;
       else if (diffMin < 1440) lastSyncText = `Strava sincronizado · hace ${Math.floor(diffMin/60)} h`;
       else lastSyncText = `Strava sincronizado · hace ${Math.floor(diffMin/1440)} d`;
    } else {
       lastSyncText = "Strava conectado (sin sincro)";
    }
  }

  // 2. Today logic
  const todayData = dashboard?.timeline?.find(d => d.date === todayIso);
  const todayActivities = todayData?.activities || [];
  const hasCompletedActivity = todayActivities.length > 0;
  
  let todayTitle = "Día Libre / Recuperación";
  let todayWorkoutType: "easy_run" | "intervals" | "tempo" | "long_run" | "rest" = "rest";

  if (hasCompletedActivity) {
    todayTitle = todayActivities[0].name || "Actividad completada";
    todayWorkoutType = "easy_run";
  }

  const handleManualRunSubmit = async (_data: any) => {
    // Refresh dashboard on submit
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20">
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
        lastSyncText={lastSyncText}
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
          sessionTitle={todayTitle}
          workoutType={todayWorkoutType}
          isCompleted={hasCompletedActivity}
          onAction={() => setIsManualSheetOpen(true)}
        />
      </div>

      {/* Weekly Volume Card */}
      <VolumeCard
        currentKm={currentKm}
        targetKm={targetKm}
        avgPaceText={avgPaceText}
        onOpenCalendar={() => navigate({ to: "/analytics" as any })}
      />

      <TargetRaceCard
        raceName={upcomingRace?.event_name}
        daysRemaining={upcomingRace ? daysToRace : undefined}
        dateText={upcomingRace ? new Date(upcomingRace.date).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }) : undefined}
        distanceKm={upcomingRace?.distance_km}
        targetTimeText={targetTimeText}
        targetPaceText={targetPaceText}
        onClick={() => navigate({ to: "/races" as any })}
      />

      {/* Weekly Streak Card */}
      <StreakCard
        streakWeeks={0}
        completedSessions={kpis?.sessions || 0}
        plannedSessions={4}
        onOpenCalendar={() => navigate({ to: "/analytics" as any })}
      />

      {/* AI Coach Proposal Card */}
      <CoachCard
        title="AI Coach en desarrollo..."
        subtitle="Las rutinas y planes inteligentes estarán disponibles pronto."
        hasProposal={false}
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
