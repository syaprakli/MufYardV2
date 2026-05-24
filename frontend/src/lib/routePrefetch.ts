type RouteLoader = () => Promise<unknown>;

const routeLoaders: Record<string, RouteLoader> = {
    "/": () => import("../pages/Dashboard"),
    "/dashboard": () => import("../pages/Dashboard"),
    "/tasks": () => import("../pages/Tasks"),
    "/report-analytics": () => import("../pages/ReportAnalytics"),
    "/audit": () => import("../pages/Audit"),
    "/notes": () => import("../pages/Notes"),
    "/files": () => import("../pages/Files"),
    "/legislation": () => import("../pages/Legislation"),
    "/calendar": () => import("../pages/Calendar"),
    "/contacts": () => import("../pages/Contacts"),
    "/messages": () => import("../pages/Messages"),
    "/public-space": () => import("../pages/PublicSpace"),
    "/assistant": () => import("../pages/Assistant"),
    "/feedback": () => import("../pages/Feedback"),
    "/about": () => import("../pages/About"),
    "/settings": () => import("../pages/Settings"),
    "/admin": () => import("../pages/FounderHub"),
    "/admin/feedback": () => import("../pages/AdminFeedback"),
    "/admin/inspectors": () => import("../pages/AdminInspectors"),
    "/admin/roles": () => import("../pages/AdminRoleSettings"),
    "/admin/licenses": () => import("../pages/AdminLicenses")
};

const heavyIntentLoadersByRoute: Record<string, RouteLoader[]> = {
    "/audit": [
        () => import("../pages/ReportEditor"),
        () => import("../components/report/ReportEditorTinyMCE")
    ],
    "/tasks": [
        () => import("../pages/ReportEditor"),
        () => import("../components/report/ReportEditorTinyMCE")
    ]
};

const prefetchedRoutes = new Set<string>();
const prefetchedHeavyRoutes = new Set<string>();

function canPrefetchHeavyAssets(): boolean {
    if (typeof navigator === "undefined") return true;
    const connection = (navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;

    if (!connection) return true;
    if (connection.saveData) return false;
    if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false;
    return true;
}

function scheduleIdle(task: () => void): void {
    const globalScope = globalThis as typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };

    if (typeof globalScope.requestIdleCallback === "function") {
        globalScope.requestIdleCallback(() => task(), { timeout: 1200 });
        return;
    }

    globalThis.setTimeout(task, 300);
}

function scheduleHeavyPrefetch(routePath: string): void {
    if (!canPrefetchHeavyAssets()) return;
    if (prefetchedHeavyRoutes.has(routePath)) return;

    const heavyLoaders = heavyIntentLoadersByRoute[routePath];
    if (!heavyLoaders || heavyLoaders.length === 0) return;

    prefetchedHeavyRoutes.add(routePath);
    scheduleIdle(() => {
        void Promise.allSettled(heavyLoaders.map((loader) => loader())).then((results) => {
            const allRejected = results.every((result) => result.status === "rejected");
            if (allRejected) {
                prefetchedHeavyRoutes.delete(routePath);
            }
        });
    });
}

export function prefetchRoute(path: string): void {
    const routePath = path.split("?")[0];
    if (!routePath) return;

    if (prefetchedRoutes.has(routePath)) return;

    const loader = routeLoaders[routePath];
    if (!loader) return;

    prefetchedRoutes.add(routePath);
    void loader().catch(() => {
        prefetchedRoutes.delete(routePath);
    });

    scheduleHeavyPrefetch(routePath);
}
