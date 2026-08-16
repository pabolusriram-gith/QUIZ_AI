export interface SidebarItem {
  name: string;
  path: string;
  iconName: string;
  isComingSoon?: boolean;
}

export const sidebarConfig: SidebarItem[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
    iconName: "LayoutDashboard",
  },
  {
    name: "Question Bank",
    path: "/dashboard/question-bank",
    iconName: "BookOpen",
  },
  {
    name: "Quizzes",
    path: "/dashboard/quizzes",
    iconName: "FileSpreadsheet",
  },
  {
    name: "Live Quiz",
    path: "/dashboard/live-quiz",
    iconName: "PlayCircle",
    isComingSoon: false,
  },
  {
    name: "Analytics",
    path: "/dashboard/analytics",
    iconName: "BarChart3",
  },
  {
    name: "AI Analytics",
    path: "/dashboard/analytics/ai",
    iconName: "BrainCircuit",
  },
  {
    name: "Reports",
    path: "/dashboard/reports",
    iconName: "FileDown",
  },
  {
    name: "Settings",
    path: "/settings",
    iconName: "Settings",
  },
];
