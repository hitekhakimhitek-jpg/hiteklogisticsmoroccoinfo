const SettingsLoader = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
    <svg className="w-44 h-40" viewBox="0 0 176 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(33,90%,55%)" />
          <stop offset="30%" stopColor="hsl(33,90%,55%)" />
          <stop offset="100%" stopColor="hsl(3,90%,55%)" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="16" strokeLinecap="round">
        <circle className="animate-pulse" r="56" cx="88" cy="96" stroke="hsla(0,10%,10%,0.1)" />
        <path
          r="56"
          d="M144,96A56,56,0,0,1,32,96"
          stroke="url(#pl-grad)"
          strokeDasharray="43.98 307.87"
          className="origin-center animate-spin"
          style={{ animationDuration: "1.2s" }}
        />
      </g>
    </svg>
    <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
      Gathering and analyzing information…
    </p>
  </div>
);

export default SettingsLoader;
