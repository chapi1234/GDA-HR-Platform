import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Target } from "lucide-react";
import { getModeActions } from "../../utils/dashboardModes";
import { useLanguage } from "../../contexts/LanguageContext";

export function DashboardModeHero({ mode, userName, scopeLabel }) {
  const { t } = useLanguage();
  const fallback = t(mode.titleFallbackKey || "modes.employee.titleFallback");
  const title = t(mode.titleKey, { name: userName || fallback });

  return (
    <div className="bg-gradient-hero rounded-2xl p-6 md:p-8 text-black dark:text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge className="bg-white text-slate-900 hover:bg-white/95 border-0 shadow-sm">
            {t(mode.badgeKey)}
          </Badge>
          <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
            {title}
          </h1>
          <p className="text-sm md:text-base text-slate-700 dark:text-white/85 max-w-2xl">
            {t(mode.subtitleKey)}
          </p>
          {mode.emphasisKey ? (
            <p className="text-xs md:text-sm text-slate-600 dark:text-white/70 max-w-2xl">
              {t(mode.emphasisKey)}
            </p>
          ) : null}
          {scopeLabel ? (
            <p className="text-sm text-slate-700 dark:text-white/85">
              {scopeLabel}
            </p>
          ) : null}
        </div>
        <div className="hidden md:block shrink-0">
          <div className="bg-white/95 dark:bg-black/25 backdrop-blur-sm rounded-xl px-4 py-3 text-right border border-black/5 dark:border-white/10">
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {new Date().toLocaleDateString()}
            </div>
            <div className="text-xs text-slate-600 dark:text-white/75">{t("common.today")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardQuickActions({ mode, authCaps = {} }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const actions = getModeActions(mode, authCaps);

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Target className="w-5 h-5 text-primary" />
          <span>{t("dashboard.quickActions")}</span>
        </CardTitle>
        <CardDescription>{t("dashboard.shortcuts")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "12px",
          }}
        >
          {actions.map((action) => (
            <Button
              key={action.href + action.labelKey}
              type="button"
              variant="outline"
              style={{
                width: "100%",
                height: "40px",
                margin: 0,
              }}
              className="text-sm font-medium"
              onClick={() => navigate(action.href)}
            >
              {t(action.labelKey)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
