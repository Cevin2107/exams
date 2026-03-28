"use client";

import { useState } from "react";
import { OverviewTab } from "./OverviewTab";
import { QuestionBuilderTab } from "./QuestionBuilderTab";
import { StudentSessionsTab } from "./StudentSessionsTab";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft, Settings, ListChecks, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentDetailTabsProps {
  assignmentId: string;
  initialAssignment: any;
  initialQuestions: any[];
}

export function AssignmentDetailTabs({ assignmentId, initialAssignment, initialQuestions }: AssignmentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "students">("overview");
  
  const TABS = [
    { id: "overview", label: "Tổng quan & Cài đặt", icon: Settings },
    { id: "questions", label: "Bộ câu hỏi", icon: ListChecks },
    { id: "students", label: "Học sinh & Chấm điểm", icon: Users },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 space-y-6 animate-fade-in transition-colors duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-6 rounded-3xl shadow-sm">
        <div>
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Quay lại Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg text-white">
                <Settings className="h-5 w-5" />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{initialAssignment?.title || "Chi tiết bài tập"}</h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Quản lý cấu hình, bộ câu hỏi và theo dõi quá trình làm bài.</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-2 rounded-2xl shadow-sm">
        <nav className="flex space-x-2" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "group inline-flex items-center rounded-xl px-5 py-3 text-sm font-bold transition-all",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Icon
                  className={cn(
                    "mr-2.5 h-4 w-4 transition-colors",
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"
                  )}
                  aria-hidden="true"
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab assignmentId={assignmentId} initialData={initialAssignment} />
        )}
        {activeTab === "questions" && (
          <QuestionBuilderTab assignmentId={assignmentId} initialQuestions={initialQuestions} />
        )}
        {activeTab === "students" && (
          <StudentSessionsTab assignmentId={assignmentId} />
        )}
      </div>
    </div>
  );
}
