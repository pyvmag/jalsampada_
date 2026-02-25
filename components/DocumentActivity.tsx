"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Clock } from "lucide-react";
import { fetchDocumentTimeline } from "@/api/rpc";

interface DocumentActivityProps {
    doctype: string;
    docname: string;
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    currentUserEmail?: string;
    modifiedStr?: string;
    modifiedBy?: string;
    isInitialized: boolean;
}

const DocumentActivity = ({
    doctype,
    docname,
    baseUrl,
    apiKey,
    apiSecret,
    currentUserEmail,
    modifiedStr,
    modifiedBy,
    isInitialized,
}: DocumentActivityProps) => {
    const [timelineData, setTimelineData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);
    const [showAll, setShowAll] = React.useState(true);

    const [visibleCount, setVisibleCount] = React.useState(10);

    const fetchTimeline = React.useCallback(async () => {
        if (!apiKey || !apiSecret || !isInitialized || !docname) return;

        try {
            setLoading(true);
            const host = baseUrl.replace("/api/resource", "");
            const response = await fetchDocumentTimeline(
                doctype,
                decodeURIComponent(docname),
                host,
                apiKey,
                apiSecret
            );
            setTimelineData(response.message || response);
        } catch (err) {
            console.error("Timeline fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [doctype, docname, baseUrl, apiKey, apiSecret, isInitialized]);

    React.useEffect(() => {
        fetchTimeline();
    }, [fetchTimeline]);

    const {
        comments = [],
        versions = [],
        communications = [],
        attachment_logs = [],
        info_logs = [],
        assignment_logs = [],
        user_info = {},
    } = timelineData?.docinfo || {};

    const rawEvents = React.useMemo(() => {
        if (!timelineData?.docinfo) return [];
        return [
            ...comments.map((c: any) => ({ ...c, _category: "comment" })),
            ...versions.map((v: any) => ({ ...v, _category: "version" })),
            ...communications.map((c: any) => ({ ...c, _category: "communication" })),
            ...attachment_logs.map((a: any) => ({ ...a, _category: "attachment" })),
            ...info_logs.map((i: any) => ({ ...i, _category: "info" })),
            ...assignment_logs.map((a: any) => ({ ...a, _category: "assignment" })),
        ];
    }, [timelineData, comments, versions, communications, attachment_logs, info_logs, assignment_logs]);

    const events = React.useMemo(() => {
        let evs = rawEvents
            .map((e) => ({ ...e, date: new Date(e.creation) }))
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (!showAll) {
            evs = evs.filter(
                (e) =>
                    e._category === "communication" ||
                    (e._category === "comment" && e.comment_type === "Comment")
            );
        }
        return evs;
    }, [rawEvents, showAll]);

    const visibleEvents = React.useMemo(() =>
        events.slice(0, visibleCount),
        [events, visibleCount]);

    const hasMore = events.length > visibleCount;

    const getInitials = (name: string) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);
    };

    const getAvatarColor = (name: string) => {
        const colors = [
            "bg-orange-100 text-orange-600",
            "bg-blue-100 text-blue-600",
            "bg-green-100 text-green-600",
            "bg-purple-100 text-purple-600",
            "bg-pink-100 text-pink-600",
        ];
        let hash = 0;
        for (let i = 0; i < (name?.length || 0); i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading && !timelineData) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!timelineData || !timelineData.docinfo) {
        return (
            <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg bg-white/50">
                No activity recorded yet for this {doctype}.
            </div>
        );
    }

    return (
        <div className="w-full mt-12 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-gray-900 pb-4 ">
                <h2 className="text-xl font-bold text-gray-900">Activity</h2>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-medium">
                            Show all activity
                        </span>
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${showAll ? "bg-gray-900" : "bg-gray-200"
                                }`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ${showAll ? "translate-x-5" : "translate-x-0.5"
                                    }`}
                            />
                        </button>
                    </div>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-md text-sm font-semibold border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm">
                        <span className="text-lg leading-none">+</span> New Email
                    </button>
                    <button
                        onClick={() => fetchTimeline()}
                        disabled={loading}
                        className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <Clock className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Events */}
            <div className="relative">
                <div className="absolute left-[11px] top-0 bottom-0 w-[1px] bg-gray-200" />
                <div className="space-y-1">
                    {/* Last Edited Banner */}
                    {modifiedStr && modifiedBy && (
                        <div className="relative py-3 pl-10">
                            <div className="flex items-center gap-4">
                                <div className="absolute left-[8px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 border-2 border-white z-20" />
                                <p className="text-sm text-gray-600">
                                    <span className="font-semibold text-gray-900 mr-1">
                                        {user_info?.[modifiedBy]?.fullname || modifiedBy}
                                    </span>
                                    last edited this
                                    <span className="text-gray-400 ml-1">
                                        · {formatDistanceToNow(new Date(modifiedStr), { addSuffix: true })}
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}

                    {visibleEvents.map((event, idx) => {
                        const actorEmail = event.comment_by || event.owner || event.sender;
                        const isMe = actorEmail === currentUserEmail;
                        const realName = user_info?.[actorEmail]?.fullname || actorEmail;
                        const displayName = isMe ? "You" : realName;
                        const isCard =
                            event._category === "communication" ||
                            (event._category === "comment" && event.comment_type === "Comment");

                        return (
                            <div key={idx} className="relative py-3 pl-10">
                                {!isCard ? (
                                    <div className="flex items-center gap-4">
                                        <div className="absolute left-[8px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-400 border-2 border-white z-20" />
                                        <p className="text-sm text-gray-600">
                                            <span className="font-semibold text-gray-900 mr-1">
                                                {displayName}
                                            </span>
                                            {event._category === "version" && (
                                                <span>
                                                    {idx === events.length - 1
                                                        ? "created this"
                                                        : "updated this"}
                                                </span>
                                            )}
                                            {event._category === "attachment" && (
                                                <span>
                                                    attached{" "}
                                                    <span dangerouslySetInnerHTML={{ __html: event.content }} />
                                                </span>
                                            )}
                                            {event._category === "assignment" && (
                                                <span>assigned this</span>
                                            )}
                                            {(event._category === "info" ||
                                                (event._category === "comment" &&
                                                    event.comment_type !== "Comment")) && (
                                                    <span
                                                        dangerouslySetInnerHTML={{
                                                            __html: event.content || "updated the status",
                                                        }}
                                                    />
                                                )}
                                            <span className="text-gray-400 ml-1">
                                                · {formatDistanceToNow(event.date, { addSuffix: true })}
                                            </span>
                                        </p>
                                    </div>
                                ) : (
                                    <div className="group relative">
                                        <div className="absolute -left-10 top-5 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm z-20">
                                            <MessageSquare className="w-3 h-3 text-gray-400" />
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                                            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 bg-white">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner ${getAvatarColor(
                                                            realName
                                                        )}`}
                                                    >
                                                        {getInitials(realName)}
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-gray-900">
                                                            {displayName}
                                                        </span>
                                                        <span className="text-gray-500 ml-1">
                                                            commented ·{" "}
                                                            {formatDistanceToNow(event.date, {
                                                                addSuffix: true,
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-xs text-gray-500 hover:text-gray-900 font-semibold">
                                                        Edit
                                                    </button>
                                                    <button className="text-gray-400 hover:text-gray-900">
                                                        ···
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <div
                                                    className="text-sm text-gray-700 prose prose-sm max-w-none prose-p:my-0 leading-relaxed"
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            event.content ||
                                                            (event.subject
                                                                ? `<b>${event.subject}</b><br/>${event.content}`
                                                                : ""),
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {hasMore && (
                        <div className="relative py-8 pl-10">
                            <button
                                onClick={() => setVisibleCount((prev) => prev + 10)}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                Load More (+{Math.min(10, events.length - visibleCount)})
                            </button>
                            <span className="ml-4 text-xs text-gray-400 font-medium">
                                Showing {visibleCount} of {events.length}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="fixed bottom-8 right-8 w-11 h-11 rounded-xl bg-white border border-gray-200 shadow-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all z-50 group"
            >
                <span className="text-xl group-hover:-translate-y-0.5 transition-transform font-bold">
                    ↑
                </span>
            </button>
        </div>
    );
};

export default DocumentActivity;
