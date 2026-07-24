import { Card, CardContent } from '../ui/card';

export const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  trend = 'up',
  className = '',
  showVsLastMonth = true,
  style,
}) => {
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card className={`dashboard-card h-full ${className}`} style={style}>
      <CardContent className="p-6 h-full">
        <div className="flex h-full min-h-[8.5rem] items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground line-clamp-2">
              {title}
            </p>
            <p className="text-2xl font-bold leading-tight text-foreground break-words sm:text-3xl">
              {value}
            </p>
            <div className="min-h-[1.25rem]">
              {change ? (
                <p className={`flex flex-wrap items-center gap-x-1 text-sm font-medium ${trendColor}`}>
                  <span>{change}</span>
                  {showVsLastMonth && (
                    <span className="text-xs font-normal text-muted-foreground">
                      vs last month
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
