"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useChatSocket } from "@/socket/useChatSocket";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import {
  apiGetIncomeUser,
  apiGetIncomeGroup,
  getConversationDetail,
  loadMessage,
  apiGetGroupUser,
  apiDisbandGroupConversation,
  apiLeaveGroupConversation
} from "@/api/conversation.api";
import { getCloudinaryImageLink } from "@/helper/croppedImageHelper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFlag, faCrown } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { apiReportMessage } from "@/api/report.api";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/helper/getErrorMessage";
import { useMessagePriority } from "@/context/messagePriority/useMessagePriority";
import { addConversation } from "@/store/slices/cacheConversationSlice";

// Base toast style, cho phép người dùng tự ý chỉnh sửa
export const toastBaseStyle: React.CSSProperties = {
  background: "#fff",
  color: "#222a33",
  borderRadius: "12px",
  border: "1px solid rgba(0,0,0,0.10)",
  cursor: "pointer",
};

type MessageToastProps = {
  name: string;
  message: string;
  avatar?: string;
  avatarCroppedArea?: any;
  onClick?: () => void; // For clickable functionality
};

function MessageToast({ name, message, avatar, avatarCroppedArea, onClick }: MessageToastProps) {
  const MAX_MESSAGE_LENGTH = 60;
  const displayMessage =
    message.length > MAX_MESSAGE_LENGTH
      ? message.slice(0, MAX_MESSAGE_LENGTH) + "..."
      : message;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        maxWidth: 320,
        borderRadius: 12,
        transition: "background 0.18s",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          border: "2.5px solid #3b82f6",
          minWidth: 40,
          minHeight: 40,
          maxWidth: 40,
          maxHeight: 40,
          width: 40,
          height: 40,
          fontWeight: 600,
          background: "linear-gradient(135deg, #d946ef, #6366f1)",
        }}
      >
        {avatar ? (
          <img
            src={
              avatarCroppedArea
                ? getCloudinaryImageLink(avatar, avatarCroppedArea, 40)
                : avatar
            }
            alt={name}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              borderRadius: "50%",
              color: "#222",
              fontWeight: 600,
              fontSize: 18,
            }}
          ></div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontWeight: 600,
          color: "#111",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {name}
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.85,
            color: "#111",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 220,
          }}
          title={message}
        >
          {displayMessage}
        </div>
      </div>
    </div>
  );
}

const MAX_OPEN_TABS = 3;
const AVATAR_SPACE = 45;

const getMinutesDiff = (a: Date | string, b: Date | string) => {
  try {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return Math.abs((+da - +db) / (60 * 1000));
  } catch (e) {
    return 0;
  }
};

const formatDateTime = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  const date = d.toLocaleDateString("vi-VN");
  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time, full: `${time} ${date}` };
};

interface ChatMessage {
  id?: string | number;
  senderId: string;
  senderName?: string;
  message: string;
  createdAt: string | Date;
  isOutgoing?: boolean;
  conversationId?: string | number;
  conversationTitle?: string;
  conversationAvatarUrl?: string;
}

interface ChatConversation {
  id: string | number;
  title: string;
  avatarUrl?: string;
  conversationId?: string | number;
  type?: "group" | "private";
  owner?: string; // <<< ADD owner here for group
}

interface ChatDockProps {
  conversations: ChatConversation[];
  onSendMessage?: (
    conversationId: ChatConversation["id"],
    text: string,
    senderName?: string
  ) => void;
  defaultOpenIds?: Array<ChatConversation["id"]>;
}

type PeerInfo = {
  name: string;
  avatar: string;
  avatarCroppedArea?: any;
};

type OpenChatOpts = {
  conversationId?: string | number;
  conversationTitle?: string;
  avatarUrl?: string;
  type?: "group" | "private";
};

type GroupUsersMap = Record<
  string | number,
  Array<{
    userId: string;
    name: string;
    avatar: string | null;
    avatarCroppedArea: { x: number; y: number; width: number; height: number } | null;
    isOwner?: boolean;
  }>
>;

type GroupOwnerMap = Record<string | number, string | undefined>; // convId -> ownerId

type LoadingState = Record<string | number, boolean>;

interface Conversation {
  conversationId: string;
  name: string;
  avatar?: string;
  avatarCroppedArea?: any;
}
interface CacheConversationsState {
  conversations: Record<string, Conversation>;
  order: string[];
}

const ChatDock: React.FC<ChatDockProps> & { openChat?: Function } = ({
  conversations: initialConversations,
  onSendMessage,
  defaultOpenIds,
}) => {
  const router = useRouter();
  const user = useSelector((state: any) => state.user);
  const userId: string = user?.userId || "";
  const name: string = user?.profile?.name || "";

  const {
    sendPrivateMessage,
    sendRoomMessage,
    listenMessages,
  } = useChatSocket(userId, name);

  const { priority, groupPriority } = useMessagePriority();

  const cacheConversations = useSelector((state: any) => state.cacheConversations?.conversations ?? {});
  const dispatch = useDispatch<AppDispatch>();

  const [privateMessages, setPrivateMessages] = useState<Record<string | number, ChatMessage[]>>({});
  const [openIds, setOpenIds] = useState<Array<ChatConversation["id"]>>(() => {
    const ids =
      (defaultOpenIds && defaultOpenIds.slice(0, MAX_OPEN_TABS)) ||
      initialConversations.slice(0, MAX_OPEN_TABS).map((c) => c.id);
    return [...ids];
  });
  const [minimizedIds, setMinimizedIds] = useState<Array<ChatConversation["id"]>>([]);
  const [drafts, setDrafts] = useState<Record<string | number, string>>({});
  const [dynamicConversations, setDynamicConversations] = useState<ChatConversation[]>([]);
  const [minimizedUnread, setMinimizedUnread] = useState<Record<string | number, number>>({});
  const [peerInfo, setPeerInfo] = useState<Record<string, PeerInfo>>({});
  const [tabConversationIds, setTabConversationIds] = useState<Record<string | number, string | number>>({});
  const [tabTypes, setTabTypes] = useState<Record<string | number, "group" | "private" | undefined>>({});
  const [groupUsersMap, setGroupUsersMap] = useState<GroupUsersMap>({});
  const [groupOwnerMap, setGroupOwnerMap] = useState<GroupOwnerMap>({});
  const [tabLoading, setTabLoading] = useState<LoadingState>({});
  const [groupInfoDialog, setGroupInfoDialog] = useState<{ open: boolean, users: Array<any>, conv: ChatConversation | null, ownerId?: string }>({ open: false, users: [], conv: null });

  // ---------- BEGIN: State cho dialog xác nhận giải tán nhóm ----------
  const [showDisbandGroupDialog, setShowDisbandGroupDialog] = useState<{
    open: boolean;
    groupName?: string;
    conversationId?: string | number;
  }>({ open: false });
  // ---------- END: State cho dialog xác nhận giải tán nhóm ----------

  // ---------- BEGIN: State cho dialog xác nhận rời nhóm ----------
  const [showLeaveGroupDialog, setShowLeaveGroupDialog] = useState<{
    open: boolean;
    groupName?: string;
    conversationId?: string | number;
  }>({ open: false });
  // ---------- END: State cho dialog xác nhận rời nhóm ----------

  const tabOpenedRef = useRef<Record<string | number, boolean>>({});
  const chatPanelsRef = useRef<Record<string | number, HTMLDivElement | null>>({});
  const scrollTriggerTabRef = useRef<Set<string | number>>(new Set());
  const scrollPendingInitTabRef = useRef<Set<string | number>>(new Set());
  const initialPromiseRef = useRef<Record<string | number, Promise<void> | null>>({});

  // Group cache for group conversations: key = conversationId, value = {conversationId, name, avatar, owner}
  const [groupCache, setGroupCache] = useState<Record<string, { conversationId: string, name: string, avatar?: string, owner?: string }>>({});

  // Handle report logic
  const [reportDialog, setReportDialog] = useState<{
    open: boolean;
    conv: any | null;
  }>({ open: false, conv: null });

  const handleReport = (conv: any) => {
    setReportDialog({ open: true, conv });
  };

  const handleReportConfirm = async () => {
    if (reportDialog.conv) {
      const { conversationId, type, id } = reportDialog.conv;
      try {
        let res;
        if (type === "group") {
          res = await apiReportMessage({
            conversationId: conversationId || id,
            type: "message",
          });
        } else {
          res = await apiReportMessage({
            userId: id,
            conversationId: conversationId || id,
            type: "message",
          });
        }
        if (res && res.success) {
          toast.success(res.message);
        }
        else {
          toast.warn(res.message);
        }
      } catch (err) {
        toast.warn(getErrorMessage(err));
      }
    }
    setReportDialog({ open: false, conv: null });
  };

  const handleReportCancel = () => {
    setReportDialog({ open: false, conv: null });
  };

  const onTabInitial = async (
    tabId: string | number,
    opts?: { conversationId?: string | number, type?: "group" | "private" }
  ) => {
    if (initialPromiseRef.current[tabId]) {
      return initialPromiseRef.current[tabId];
    }
    const initialConv = initialConversations.find(c => c.id === tabId);
    setTabLoading((prev) => ({ ...prev, [tabId]: true }));

    let promise: Promise<void>;
    if (initialConv && initialConv.conversationId) {
      promise = (async () => {
        try {
          scrollPendingInitTabRef.current.add(tabId);
          const result = await getConversationDetail({ userId: tabId as string, conversationId: initialConv.conversationId as string });
          if (result && Array.isArray(result.messages) && result.messages.length > 0) {
            setPrivateMessages((prev) => ({
              ...prev,
              [tabId]: result.messages.map((msg: any) => ({
                id: msg.id,
                senderId: msg.senderId,
                message: typeof msg.message !== "undefined" ? msg.message : "",
                createdAt: msg.createdAt,
                attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
                readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
                isOutgoing: msg.senderId === userId,
              })),
            }));
            setTabTypes((prev) => ({
              ...prev,
              [tabId]: initialConv.type,
            }));
            // truyền owner vào groupOwnerMap / groupCache nếu là group
            if (initialConv.type === "group") {
              if (result.owner) {
                setGroupOwnerMap(prev => ({
                  ...prev,
                  [tabId]: result.owner,
                }));
                setGroupCache(prev => ({
                  ...prev,
                  [String(initialConv.conversationId)]: {
                    ...(prev[String(initialConv.conversationId)] ?? {}),
                    conversationId: String(initialConv.conversationId),
                    name: result.name || initialConv.title,
                    avatar: result.avatar || initialConv.avatarUrl,
                    owner: result.owner,
                  }
                }));
              }
            }
          }
        } catch (err) {
        } finally {
          scrollPendingInitTabRef.current.delete(tabId);
          setTabLoading((prev) => ({ ...prev, [tabId]: false }));
        }
      })();
    } else {
      promise = (async () => {
        try {
          scrollPendingInitTabRef.current.add(tabId);
          const result = await getConversationDetail({ userId: tabId as string });
          if (result && result.conversationId) {
            setTabConversationIds((prev) => ({
              ...prev,
              [tabId]: result.conversationId,
            }));
          }
          setTabTypes((prev) => ({
            ...prev,
            [tabId]: opts?.type ?? initialConv?.type,
          }));
          if (result && Array.isArray(result.messages) && result.messages.length > 0) {
            setPrivateMessages((prev) => ({
              ...prev,
              [tabId]: result.messages.map((msg: any) => ({
                id: msg.id,
                senderId: msg.senderId,
                message: typeof msg.message !== "undefined" ? msg.message : "",
                createdAt: msg.createdAt,
                attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
                readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
                isOutgoing: msg.senderId === userId,
              })),
            }));
            // truyền owner vào cache nếu là group
            if ((opts?.type ?? initialConv?.type) === "group" && result.owner) {
              setGroupOwnerMap(prev => ({
                ...prev,
                [tabId]: result.owner,
              }));
              setGroupCache(prev => ({
                ...prev,
                [String(result.conversationId ?? tabId)]: {
                  ...(prev[String(result.conversationId ?? tabId)] ?? {}),
                  conversationId: String(result.conversationId ?? tabId),
                  name: result.name || initialConv?.title,
                  avatar: result.avatar || initialConv?.avatarUrl,
                  owner: result.owner,
                }
              }));
            }
          }
        } catch (err) {
        } finally {
          scrollPendingInitTabRef.current.delete(tabId);
          setTabLoading((prev) => ({ ...prev, [tabId]: false }));
        }
      })();
    }
    initialPromiseRef.current[tabId] = promise;
    promise.finally(() => {
      delete initialPromiseRef.current[tabId];
    });
    return promise;
  };

  // ============ PRIO (PRIVATE LOW + GROUP LOW) - ENABLE CACHE FOR GROUP ============
  useEffect(() => {
    // Helper: open the chat tab with correct preference (private/group, convId) from toast click
    function openChatTabToast(id: string | number, type?: "group" | "private", conversationId?: string | number) {
      // Build OpenChatOpts from toast if possible
      let opts: OpenChatOpts = {};
      if (typeof type !== "undefined") opts.type = type;
      if (typeof conversationId !== "undefined") opts.conversationId = conversationId;
      handleOpenConversation(id, opts);
    }
    // Remember a ref for the helper
    const openTabOnToastClick = openChatTabToast;

    const off = listenMessages({
      onRoomMessage: async (msg: any) => {
        if (!msg || !msg.roomId) return;
        const peerId = msg.roomId;
        let groupInfo: { conversationId: string, name: string, avatar?: string, owner?: string } | undefined = undefined;
        let groupCacheState = groupCache;

        const fetchAndSetGroupInfo = async () => {
          try {
            const incomeGroupRes = await apiGetIncomeGroup(msg.roomId);
            if (incomeGroupRes && incomeGroupRes.conversationId) {
              setGroupCache(prev => ({
                ...prev,
                [incomeGroupRes.conversationId]: {
                  conversationId: incomeGroupRes.conversationId,
                  name: incomeGroupRes.name || "",
                  avatar: incomeGroupRes.avatar || "",
                  owner: incomeGroupRes.owner || undefined,
                }
              }));
              groupCacheState = {
                ...groupCacheState,
                [incomeGroupRes.conversationId]: {
                  conversationId: incomeGroupRes.conversationId,
                  name: incomeGroupRes.name || "",
                  avatar: incomeGroupRes.avatar || "",
                  owner: incomeGroupRes.owner || undefined,
                }
              };
              // lưu lại owner mapping cho conv
              if (incomeGroupRes.owner) {
                setGroupOwnerMap(prev => ({
                  ...prev,
                  [peerId]: incomeGroupRes.owner,
                }));
              }
              return incomeGroupRes;
            }
            return undefined;
          } catch (err) {
            return undefined;
          }
        };

        let groupConvId = msg.conversationId || msg.roomId || "";

        if (
          groupConvId &&
          groupCache &&
          groupCache[groupConvId]
        ) {
          groupInfo = groupCache[groupConvId];
        }

        if (!groupInfo) {
          try {
            const groupApiResult = await fetchAndSetGroupInfo();
            if (groupApiResult && groupApiResult.conversationId) {
              groupInfo = {
                conversationId: groupApiResult.conversationId,
                name: groupApiResult.name,
                avatar: groupApiResult.avatar,
                owner: groupApiResult.owner,
              };
              groupConvId = groupApiResult.conversationId;
              // lưu lại owner
              if (groupApiResult.owner) {
                setGroupOwnerMap(prev => ({
                  ...prev,
                  [peerId]: groupApiResult.owner,
                }));
              }
            }
          } catch (err) {
            // ignored
          }
        }

        if (groupInfo?.owner) {
          setGroupOwnerMap(prev => ({
            ...prev,
            [peerId]: groupInfo!.owner,
          }));
        }

        setTabTypes((prev) => ({
          ...prev,
          [peerId]: "group",
        }));
        setTabConversationIds((prev) => ({
          ...prev,
          [peerId]: groupConvId,
        }));

        let theGroup: ChatConversation | undefined =
          initialConversations.find((c) => c.id == peerId && c.type === "group") ||
          dynamicConversations.find((c) => c.id == peerId && c.type === "group");

        let groupTitle = groupInfo?.name || msg.conversationTitle || "Nhóm";
        let groupAvatar = groupInfo?.avatar || msg.conversationAvatarUrl || "";
        let groupOwnerId = groupInfo?.owner;

        if (!theGroup) {
          theGroup = {
            id: peerId,
            title: groupTitle,
            avatarUrl: groupAvatar,
            conversationId: groupConvId,
            type: "group",
            owner: groupOwnerId,
          };
          setDynamicConversations((prev) => {
            if (!prev.some((c) => c.id === peerId)) {
              return [...prev, theGroup as ChatConversation];
            }
            return prev;
          });
        } else {
          setDynamicConversations((prev) =>
            prev.map((c) =>
              c.id === peerId
                ? {
                  ...c,
                  title: groupTitle,
                  avatarUrl: groupAvatar,
                  conversationId: groupConvId,
                  owner: groupOwnerId,
                }
                : c
            )
          );
        }

        if (minimizedIds.includes(peerId)) {
          setMinimizedUnread((prev) => ({
            ...prev,
            [peerId]: (prev[peerId] || 0) + 1,
          }));
          setPrivateMessages((prev) => ({
            ...prev,
            [peerId]: [
              ...(prev[peerId] || []),
              {
                ...msg,
                isOutgoing: msg.senderId === userId,
              },
            ],
          }));
          return;
        }

        const groupPri = groupPriority || "none";
        const isOpen = openIds.includes(peerId);

        if (isOpen) {
          setPrivateMessages((prev) => ({
            ...prev,
            [peerId]: [
              ...(prev[peerId] || []),
              {
                ...msg,
                isOutgoing: msg.senderId === userId,
              },
            ],
          }));
          setMinimizedIds((prev) => prev.filter((x) => x !== peerId));
          setMinimizedUnread((prev) => {
            if (prev[peerId]) {
              const newState = { ...prev };
              delete newState[peerId];
              return newState;
            }
            return prev;
          });
          return;
        }

        setPrivateMessages((prev) => ({
          ...prev,
          [peerId]: [
            ...(prev[peerId] || []),
            {
              ...msg,
              isOutgoing: msg.senderId === userId,
            },
          ],
        }));

        if (groupPri === "high") {
          setDynamicConversations((prevConvs) => {
            if (
              prevConvs.some((c) => c.id === peerId) ||
              initialConversations.some((c) => c.id === peerId)
            ) {
              return prevConvs;
            }
            return [
              ...prevConvs,
              {
                ...theGroup,
                id: peerId,
                title: groupTitle,
                avatarUrl: groupAvatar,
                type: "group",
                conversationId: groupConvId,
                owner: groupOwnerId,
              } as ChatConversation,
            ];
          });

          setOpenIds((prev) => {
            if (prev.includes(peerId)) return prev;
            let ids = prev.filter((x) => x !== peerId);
            let next = [...ids, peerId];
            if (next.length > MAX_OPEN_TABS) {
              const keepCount = MAX_OPEN_TABS;
              next = next.slice(next.length - keepCount);
            }
            if (!tabOpenedRef.current[peerId]) {
              tabOpenedRef.current[peerId] = true;
              setTabLoading((prev) => ({ ...prev, [peerId]: true }));
              onTabInitial(peerId, { type: "group", conversationId: groupConvId })?.then(() => {
                setTimeout(() => {
                  const node = chatPanelsRef.current[peerId];
                  if (node) {
                    node.scrollTop = node.scrollHeight;
                  }
                }, 0);
              });
              return next;
            }
            return next;
          });
          setMinimizedIds((prev) => prev.filter((x) => x !== peerId));
          setMinimizedUnread((prev) => {
            if (prev[peerId]) {
              const newState = { ...prev };
              delete newState[peerId];
              return newState;
            }
            return prev;
          });
        } else if (groupPri === "low") {
          // === REWRITE TOAST HERE TO SUPPORT CLICK-TO-OPEN TAB ===
          const senderDisplay = msg.senderName || "Người dùng";
          toast(
            <MessageToast
              name={groupTitle}
              message={`${senderDisplay}\n: ${msg.message}`}
              avatar={groupAvatar}
              onClick={() =>
                openTabOnToastClick(
                  peerId,
                  "group",
                  groupConvId
                )
              }
            />,
            {
              containerId: "chat",
              style: toastBaseStyle,
              onClick: () =>
                openTabOnToastClick(
                  peerId,
                  "group",
                  groupConvId
                ),
              closeOnClick: true,
              draggable: false,
              pauseOnHover: false,
            }
          );
        }
        // none: ko alert
      },

      // ... onPrivateMessage same as before ...
      // BELOW REMAINS UNCHANGED
      // (cut for brevity; ensure you include the unchanged logic as in your code)
      // (If copying, keep original - omitted here for clarity)
      // (No changes to onPrivateMessage for this instruction)
      onPrivateMessage: async (msg: any) => {
        let peerId = msg.senderId;
        if (!peerId) return;

        const isGroup = msg?.type === "group";
        const pri = isGroup ? groupPriority : priority;

        let conversationIdFromMsg = msg && msg.conversationId ? msg.conversationId : undefined;

        if (conversationIdFromMsg) {
          if (peerId !== userId) {
            setTabConversationIds((prev) => ({
              ...prev,
              [peerId]: conversationIdFromMsg,
            }));
          } else {
            setTabConversationIds((prev) => ({
              ...prev,
              [msg.receiverId]: conversationIdFromMsg,
            }));
            return;
          }
        }

        if (msg.type === "group" || msg.type === "private") {
          setTabTypes((prev) => ({
            ...prev,
            [peerId]: msg.type,
          }));
        }

        let fetchedName = peerInfo[peerId]?.name || msg.senderName || msg.conversationTitle || "Người dùng";
        let fetchedAvatar = peerInfo[peerId]?.avatar || msg.conversationAvatarUrl || "";
        let fetchedAvatarCroppedArea = peerInfo[peerId]?.avatarCroppedArea || undefined;
        const hasPeerInfo = !!peerInfo[peerId];

        const fetchAndSetIncomeUser = async () => {
          try {
            const incomeUser = await apiGetIncomeUser(peerId);
            if (incomeUser && incomeUser.name) {
              fetchedName = incomeUser.name;
            }
            if (incomeUser && incomeUser.avatar) {
              fetchedAvatar = incomeUser.avatar;
            }
            if (incomeUser && incomeUser.avatarCroppedArea) {
              fetchedAvatarCroppedArea = incomeUser.avatarCroppedArea;
            }
            if (incomeUser && incomeUser.conversationId) {
              setTabConversationIds((prev) => ({
                ...prev,
                [peerId]: incomeUser.conversationId,
              }));
            }
            setPeerInfo((prev) => ({
              ...prev,
              [peerId]: {
                name: fetchedName,
                avatar: fetchedAvatar,
                avatarCroppedArea: fetchedAvatarCroppedArea,
              },
            }));
            return incomeUser;
          } catch (err) {
            return undefined;
          }
        };

        if (pri === "low" && !isGroup) {
          let cachedConv: Conversation | undefined;
          const conversationIdStr = conversationIdFromMsg ? String(conversationIdFromMsg) : undefined;

          if (conversationIdStr && cacheConversations && cacheConversations[conversationIdStr]) {
            cachedConv = cacheConversations[conversationIdStr];
          }
          if (cachedConv) {
            fetchedName = cachedConv.name;
            fetchedAvatar = cachedConv.avatar || "";
            fetchedAvatarCroppedArea = cachedConv.avatarCroppedArea;

            setTabConversationIds((prev) => {
              const next: Record<string | number, string | number> = { ...prev };
              if (conversationIdStr !== undefined) {
                next[peerId] = conversationIdStr;
              }
              return next;
            });
            setPeerInfo((prev) => ({
              ...prev,
              [peerId]: {
                name: fetchedName,
                avatar: fetchedAvatar,
                avatarCroppedArea: fetchedAvatarCroppedArea,
              },
            }));

            if (pri === "low") {
              toast(
                <MessageToast
                  name={cachedConv.name}
                  message={msg.message}
                  avatar={cachedConv.avatar}
                  avatarCroppedArea={cachedConv.avatarCroppedArea}
                  onClick={() =>
                    openTabOnToastClick(
                      peerId,
                      "private",
                      conversationIdStr
                    )
                  }
                />,
                {
                  containerId: "chat",
                  style: toastBaseStyle,
                  onClick: () =>
                    openTabOnToastClick(
                      peerId,
                      "private",
                      conversationIdStr
                    ),
                  closeOnClick: true,
                  draggable: false,
                  pauseOnHover: false,
                }
              );
            }
          } else {
            try {
              const apiRes = await fetchAndSetIncomeUser();
              if (apiRes && apiRes.conversationId) {
                dispatch(
                  addConversation({
                    conversationId: String(apiRes.conversationId),
                    name: apiRes.name || "",
                    avatar: apiRes.avatar,
                    avatarCroppedArea: apiRes.avatarCroppedArea,
                  })
                );
              }

              if (pri === "low" && apiRes) {
                toast(
                  <MessageToast
                    name={apiRes.name}
                    message={msg.message}
                    avatar={apiRes.avatar}
                    avatarCroppedArea={apiRes.avatarCroppedArea}
                    onClick={() =>
                      openTabOnToastClick(
                        peerId,
                        "private",
                        apiRes.conversationId
                      )
                    }
                  />,
                  {
                    containerId: "chat",
                    style: toastBaseStyle,
                    onClick: () =>
                      openTabOnToastClick(
                        peerId,
                        "private",
                        apiRes.conversationId
                      ),
                    closeOnClick: true,
                    draggable: false,
                    pauseOnHover: false,
                  }
                );
              }
            } catch (err) {
              // Ignore
            }
          }
        } else if (!hasPeerInfo && (pri === "high" || (pri === "low" && isGroup))) {
          await fetchAndSetIncomeUser();
        }

        if (minimizedIds.includes(peerId)) {
          setMinimizedUnread((prev) => ({
            ...prev,
            [peerId]: (prev[peerId] || 0) + 1,
          }));
          setPrivateMessages((prev) => {
            const updated = {
              ...prev,
              [peerId]: [
                ...(prev[peerId] || []),
                {
                  ...msg,
                  isOutgoing: msg.senderId === userId,
                },
              ],
            };
            return updated;
          });
          return;
        }

        if (openIds.includes(peerId)) {
          setPrivateMessages((prev) => {
            const updated = {
              ...prev,
              [peerId]: [
                ...(prev[peerId] || []),
                {
                  ...msg,
                  isOutgoing: msg.senderId === userId,
                },
              ],
            };
            return updated;
          });
          setMinimizedIds((prev) => prev.filter((x) => x !== peerId));
          setMinimizedUnread((prev) => {
            if (prev[peerId]) {
              const newState = { ...prev };
              delete newState[peerId];
              return newState;
            }
            return prev;
          });
          return;
        }

        setDynamicConversations((prevConvs) => {
          if (
            prevConvs.some((c) => c.id === peerId) ||
            initialConversations.some((c) => c.id === peerId)
          ) {
            return prevConvs;
          }
          return [
            ...prevConvs,
            {
              id: peerId,
              title: fetchedName,
              avatarUrl: fetchedAvatar,
              type: msg.type,
            },
          ];
        });

        setPrivateMessages((prev) => {
          const updated = {
            ...prev,
            [peerId]: [
              ...(prev[peerId] || []),
              {
                ...msg,
                isOutgoing: msg.senderId === userId,
              },
            ],
          };
          return updated;
        });

        if (pri === "high") {
          setOpenIds((prev) => {
            if (prev.includes(peerId)) return prev;
            let ids = prev.filter((x) => x !== peerId);
            let next = [...ids, peerId];
            if (next.length > MAX_OPEN_TABS) {
              const keepCount = MAX_OPEN_TABS;
              next = next.slice(next.length - keepCount);
            }
            if (!tabOpenedRef.current[peerId]) {
              tabOpenedRef.current[peerId] = true;
              setTabLoading((prev) => ({ ...prev, [peerId]: true }));
              onTabInitial(peerId, { type: msg.type })?.then(() => {
                setTimeout(() => {
                  const node = chatPanelsRef.current[peerId];
                  if (node) {
                    node.scrollTop = node.scrollHeight;
                  }
                }, 0);
              });
              return next;
            }
            return next;
          });
          setMinimizedIds((prev) => prev.filter((x) => x !== peerId));
          setMinimizedUnread((prev) => {
            if (prev[peerId]) {
              const newState = { ...prev };
              delete newState[peerId];
              return newState;
            }
            return prev;
          });
        }
      },
    });
    return () => off?.();
    // eslint-disable-next-line
  }, [
    userId,
    name,
    initialConversations,
    openIds,
    minimizedIds,
    peerInfo,
    priority,
    groupPriority,
    dynamicConversations,
    cacheConversations,
    groupCache,
    dispatch
  ]);

  useEffect(() => { }, [privateMessages]);

  const mergedConversations = useMemo(() => {
    const merged: ChatConversation[] = [
      ...initialConversations,
      ...dynamicConversations.map((dc) => {
        let owner = dc.owner;
        if (peerInfo[dc.id as string]) {
          const _peerInfo = peerInfo[dc.id as string];
          return {
            ...dc,
            title: _peerInfo.name,
            avatarUrl: _peerInfo.avatar,
            owner,
          };
        }
        // For group: check groupCache as well, prefer over message props (for groupName/avatar change)
        if (dc.type === "group") {
          const groupConvId =
            (typeof dc.conversationId === "string" ? dc.conversationId : undefined) ||
            (typeof dc.id === "string" ? dc.id : undefined);
          if (
            groupConvId &&
            groupCache[groupConvId]
          ) {
            owner = groupCache[groupConvId].owner;
            return {
              ...dc,
              title: groupCache[groupConvId].name,
              avatarUrl: groupCache[groupConvId].avatar,
              conversationId: groupConvId,
              owner,
            };
          }
        }
        return dc;
      }).filter(
        (dc) => !initialConversations.some((ic) => ic.id === dc.id)
      ),
    ];
    return merged;
  }, [initialConversations, dynamicConversations, peerInfo, groupCache]);

  const openConversations = useMemo(() => {
    const result: Array<{
      id: string | number;
      title: string;
      avatarUrl?: string;
      messages: ChatMessage[];
      conversationId?: string | number;
      type?: "group" | "private";
      owner?: string;
    }> = [];
    const realConvs = openIds
      .map((id) => {
        const c = mergedConversations.find((cv) => cv.id === id);
        if (!c) return undefined;
        const conversationId: string | number | undefined =
          tabConversationIds[id] ?? c.conversationId ?? undefined;
        const type: "group" | "private" | undefined = tabTypes[id] ?? c.type;
        let owner = c.owner;
        // For group: prefer groupCache for name/avatar/owner
        let title = c.title;
        let avatarUrl = c.avatarUrl;
        if (type === "group" && conversationId && groupCache[String(conversationId)]) {
          title = groupCache[String(conversationId)].name;
          avatarUrl = groupCache[String(conversationId)].avatar;
          owner = groupCache[String(conversationId)].owner;
        } else if (type === "group" && c.owner) {
          owner = c.owner;
        }
        return {
          ...c,
          title,
          avatarUrl,
          messages: privateMessages[id] || [],
          conversationId,
          type,
          owner,
        };
      })
      .filter(Boolean) as Array<{
        id: string | number;
        title: string;
        avatarUrl?: string;
        messages: ChatMessage[];
        conversationId?: string | number;
        type?: "group" | "private";
        owner?: string;
      }>;
    result.push(...realConvs);
    return result;
  }, [openIds, mergedConversations, privateMessages, tabConversationIds, tabTypes, groupCache]);

  const minimizedConversations = useMemo(
    () =>
      minimizedIds
        .map((id) => {
          const c = mergedConversations.find((cv) => cv.id === id);
          if (!c) return undefined;
          const conversationId: string | number | undefined =
            tabConversationIds[id] ?? c.conversationId ?? undefined;
          const type: "group" | "private" | undefined = tabTypes[id] ?? c.type;

          let title = c.title;
          let avatarUrl = c.avatarUrl;
          let owner = c.owner;
          if (type === "group" && conversationId && groupCache[String(conversationId)]) {
            title = groupCache[String(conversationId)].name;
            avatarUrl = groupCache[String(conversationId)].avatar;
            owner = groupCache[String(conversationId)].owner;
          } else if (type === "group" && c.owner) {
            owner = c.owner;
          }
          return {
            ...c,
            title,
            avatarUrl,
            messages: privateMessages[id] || [],
            conversationId,
            type,
            owner,
          };
        })
        .filter(Boolean) as Array<{
          id: string | number;
          title: string;
          avatarUrl?: string;
          messages: ChatMessage[];
          conversationId?: string | number;
          type?: "group" | "private";
          owner?: string;
        }>,
    [minimizedIds, mergedConversations, privateMessages, tabConversationIds, tabTypes, groupCache]
  );

  const handleOpenConversation = (
    id: ChatConversation["id"],
    opts?: OpenChatOpts
  ) => {
    if (!tabOpenedRef.current[id]) {
      tabOpenedRef.current[id] = true;
      setOpenIds((prev) => {
        const ids = prev.filter((x) => x !== id);
        let next = [...ids, id];
        if (next.length > MAX_OPEN_TABS) {
          const keepCount = MAX_OPEN_TABS;
          next = next.slice(next.length - keepCount);
        }
        return next;
      });
      setMinimizedIds((prev) => prev.filter((x) => x !== id));
      setMinimizedUnread((prev) => {
        if (prev[id]) {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        }
        return prev;
      });
      setTabLoading((prev) => ({ ...prev, [id]: true }));
      onTabInitial(id, opts)?.then(async () => {
        tabOpenedRef.current[id] = true;
        const conversationType: "group" | "private" | undefined =
          tabTypes[id] ??
          mergedConversations.find((c) => c.id === id)?.type ??
          opts?.type;
        const conversationId: string | number | undefined =
          tabConversationIds[id] ??
          mergedConversations.find((c) => c.id === id)?.conversationId ??
          opts?.conversationId;
        if (conversationType === "group" && conversationId) {
          try {
            const groupUser = await apiGetGroupUser(conversationId.toString());
            setGroupUsersMap((prev) => ({
              ...prev,
              [id]: Array.isArray(groupUser?.users) ? groupUser.users : [],
            }));
            // truyền owner vào groupOwnerMap nếu groupUser.owner có trả về owner
            if (groupUser && groupUser.owner) {
              setGroupOwnerMap((prev) => ({
                ...prev,
                [id]: groupUser.owner
              }));
            }
          } catch (err) { }
        }
        setTabLoading((prev) => ({ ...prev, [id]: false }));
        setTimeout(() => {
          const node = chatPanelsRef.current[id];
          if (node) {
            node.scrollTop = node.scrollHeight;
          }
        }, 0);
      });
      setTimeout(() => {
        const node = chatPanelsRef.current[id];
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
      }, 0);
      return;
    }
    setOpenIds((prev) => {
      const filtered = prev.filter((x) => x !== id);
      return [...filtered, id];
    });
    setMinimizedIds((prev) => prev.filter((x) => x !== id));
    setMinimizedUnread((prev) => {
      if (prev[id]) {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      }
      return prev;
    });
    setTimeout(() => {
      const node = chatPanelsRef.current[id];
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    }, 0);
  };

  ChatDock.openChat = (peerId: string | number, opts?: OpenChatOpts) => {
    handleOpenConversation(peerId, opts);
  };

  useEffect(() => {
    if (defaultOpenIds && defaultOpenIds.length > 0) {
      const id = defaultOpenIds[0];
      handleOpenConversation(id);
    }
  }, [defaultOpenIds]);

  const handleMinimize = (id: ChatConversation["id"]) => {
    setOpenIds((prev) => prev.filter((x) => x !== id));
    setMinimizedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleCloseAll = () => {
    setOpenIds([]);
    setMinimizedIds([]);
    setDrafts({});
    setPrivateMessages({});
    setDynamicConversations([]);
    setMinimizedUnread({});
    setPeerInfo({});
    setTabConversationIds({});
    setTabTypes({});
    setGroupUsersMap({});
    setTabLoading({});
    setGroupCache({});
    setGroupOwnerMap({});
    tabOpenedRef.current = {};
    chatPanelsRef.current = {};
    scrollTriggerTabRef.current = new Set();
    scrollPendingInitTabRef.current = new Set();
    initialPromiseRef.current = {};
  };

  const handleClose = (id: ChatConversation["id"]) => {
    setOpenIds((prev) => prev.filter((x) => x !== id));
    setMinimizedIds((prev) => prev.filter((x) => x !== id));
    setDrafts((prev) => {
      const cp = { ...prev };
      delete cp[id];
      return cp;
    });
    setPrivateMessages((prev) => {
      const cp = { ...prev };
      delete cp[id];
      return cp;
    });
    setMinimizedUnread((prev) => {
      const cp = { ...prev };
      delete cp[id];
      return cp;
    });
    setDynamicConversations((prev) => prev.filter((c) => c.id !== id));
    setPeerInfo((prev) => {
      const cp = { ...prev };
      delete cp[id as string];
      return cp;
    });
    setTabConversationIds((prev) => {
      const next: Record<string | number, string | number> = { ...prev };
      if (next.hasOwnProperty(id)) {
        delete next[id];
      }
      return next;
    });
    setTabTypes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setGroupUsersMap((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setTabLoading((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setGroupCache((prev) => {
      const n = { ...prev };
      if (n[id as string]) delete n[id as string];
      return n;
    });
    setGroupOwnerMap((prev) => {
      const n = { ...prev };
      if (n[id as string]) delete n[id as string];
      return n;
    });
    delete tabOpenedRef.current[id];
    delete chatPanelsRef.current[id];
    scrollTriggerTabRef.current.delete(id);
    scrollPendingInitTabRef.current.delete(id);
    delete initialPromiseRef.current[id];
  };

  const handleChangeDraft = (
    id: ChatConversation["id"],
    value: string
  ) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  // CHỈ SỬA ĐOẠN DƯỚI ĐỂ ĐẢM BẢO LUÔN GỬI conversationId KHI sendPrivateMessage
  const handleSend = async (id: ChatConversation["id"]) => {
    const text = (drafts[id] || "").trim();
    if (!text) return;

    const conversationIdOfTab = tabConversationIds[id] ??
      (mergedConversations.find((c) => c.id === id)?.conversationId);

    const convType: "group" | "private" | undefined =
      tabTypes[id] ||
      (mergedConversations.find((c) => c.id === id)?.type) ||
      undefined;

    const message: ChatMessage =
      convType === "group"
        ? {
          senderId: userId,
          senderName: name,
          message: text,
          createdAt: new Date(),
          isOutgoing: true,
          conversationId: conversationIdOfTab ?? undefined,
        }
        : {
          senderId: userId,
          message: text,
          createdAt: new Date(),
          isOutgoing: true,
          conversationId: conversationIdOfTab ?? undefined,
        };

    if (convType === "group") {
      setPrivateMessages((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), { ...message }],
      }));
      try {
        const roomId =
          conversationIdOfTab != null
            ? conversationIdOfTab.toString()
            : id.toString();
        sendRoomMessage && sendRoomMessage(roomId, text);
        setDrafts((prev) => ({ ...prev, [id]: "" }));
      } catch (err) { }
      setTimeout(() => {
        const node = chatPanelsRef.current[id];
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
      }, 0);
      return;
    }

    let needInitial = false;
    if (!tabOpenedRef.current[id]) {
      needInitial = true;
      await onTabInitial(id);
      tabOpenedRef.current[id] = true;
    }

    setPrivateMessages((prev) => {
      const updated = {
        ...prev,
        [id]: [...(prev[id] || []), { ...message }],
      };
      return updated;
    });

    setOpenIds((prev) => {
      if (prev.includes(id)) {
        const filtered = prev.filter((x) => x !== id);
        return [...filtered, id];
      }
      let ids = prev.filter((x) => x !== id);
      let next = [...ids, id];
      if (next.length > MAX_OPEN_TABS) {
        const keepCount = MAX_OPEN_TABS;
        next = next.slice(next.length - keepCount);
      }
      return next;
    });
    setMinimizedIds((prev) => prev.filter((x) => x !== id));
    setMinimizedUnread((prev) => {
      if (prev[id]) {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      }
      return prev;
    });

    try {
      if (conversationIdOfTab != null) {
        sendPrivateMessage(
          id.toString(),
          text,
          conversationIdOfTab.toString()
        );
      } else {
        sendPrivateMessage(
          id.toString(),
          text,
          undefined
        );
      }
      setDrafts((prev) => ({ ...prev, [id]: "" }));
      setTimeout(() => {
        const node = chatPanelsRef.current[id];
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
      }, 0);
    } catch (err) {
      try {
        onSendMessage?.(id, text, name);
        setDrafts((prev) => ({ ...prev, [id]: "" }));
        setTimeout(() => {
          const node = chatPanelsRef.current[id];
          if (node) {
            node.scrollTop = node.scrollHeight;
          }
        }, 0);
      } catch (_err) { }
    }
  };

  useEffect(() => {
    openConversations.forEach((conv) => {
      if (scrollTriggerTabRef.current.has(conv.id)) {
        if (scrollPendingInitTabRef.current.has(conv.id)) {
          return;
        }
        const node = chatPanelsRef.current[conv.id];
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
        scrollTriggerTabRef.current.delete(conv.id);
      }
    });
  }, [openConversations]);

  const loadingScrollRef = useRef<Record<string | number, boolean>>({});
  const finishedScrollRef = useRef<Record<string | number, boolean>>({});

  const handleChatPanelScroll = useCallback(
    (
      convId: string | number,
      convMessages?: ChatMessage[],
      convConversationId?: string | number
    ) => async (e: React.UIEvent<HTMLDivElement>) => {
      const node = e.currentTarget;

      if (finishedScrollRef.current[convId]) return;
      if (loadingScrollRef.current[convId]) return;

      if (node.scrollTop <= 1) {
        let oldMsg =
          convMessages && Array.isArray(convMessages) && convMessages.length > 0
            ? convMessages[0]
            : undefined;
        let conversationIdToShow =
          typeof convConversationId !== "undefined"
            ? convConversationId
            : oldMsg?.conversationId ??
            (convMessages && convMessages.length > 0
              ? convMessages[0].conversationId
              : undefined);
        let cursorAt =
          oldMsg && oldMsg.createdAt
            ? oldMsg.createdAt instanceof Date
              ? oldMsg.createdAt.toISOString()
              : new Date(oldMsg.createdAt).toISOString()
            : undefined;

        if (finishedScrollRef.current[convId]) return;

        if (conversationIdToShow) {
          try {
            loadingScrollRef.current[convId] = true;
            const response = await loadMessage(
              conversationIdToShow as string,
              cursorAt
            );

            if (
              !response ||
              response.messages === null ||
              (Array.isArray(response.messages) && response.messages.length === 0)
            ) {
              finishedScrollRef.current[convId] = true;
              loadingScrollRef.current[convId] = false;
              return;
            }

            if (Array.isArray(response.messages) && response.messages.length > 0) {
              setPrivateMessages((prev) => {
                const existing = prev[convId] || [];
                const newMsgs: ChatMessage[] = response.messages.map((msg: any) => ({
                  id: msg.id,
                  senderId: msg.senderId,
                  message: typeof msg.message !== "undefined" ? msg.message : "",
                  createdAt: msg.createdAt,
                  attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
                  readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
                  isOutgoing: msg.senderId === userId,
                  conversationId: msg.conversationId,
                }));

                const existingIds = new Set(existing.map((m) => m.id));
                const trulyNew = newMsgs.filter((m) => m.id && !existingIds.has(m.id));

                return {
                  ...prev,
                  [convId]: [...trulyNew, ...existing],
                };
              });

              setTimeout(() => {
                if (node) {
                  node.scrollTop = 1;
                }
              }, 0);
            }
          } catch (error) {
            console.error(
              "[ChatDock][handleChatPanelScroll] loadMessage error: ",
              error
            );
          } finally {
            loadingScrollRef.current[convId] = false;
          }
        } else {
          // console.log(
          //   "[ChatDock][handleChatPanelScroll] No valid conversationId to fetch more messages."
          // );
        }
      }
    },
    [userId]
  );

  function isFirstMessageOfDay(messages: ChatMessage[], idx: number): boolean {
    if (idx === 0) return true;
    const curMsg = messages[idx];
    const prevMsg = messages[idx - 1];
    if (!curMsg?.createdAt || !prevMsg?.createdAt) return false;
    const curDate = new Date(curMsg.createdAt);
    const prevDate = new Date(prevMsg.createdAt);
    return (
      curDate.getDate() !== prevDate.getDate() ||
      curDate.getMonth() !== prevDate.getMonth() ||
      curDate.getFullYear() !== prevDate.getFullYear()
    );
  }
  function isFirstMessageOfDay_Bundle(messages: ChatMessage[], idx: number): boolean {
    return isFirstMessageOfDay(messages, idx);
  }

  const handleGoToUserProfile = (userIdTo: string) => {
    if (!userIdTo) return;
    router.push(`/profile/${userIdTo}`);
  };

  // SỬA: truy vấn ownerId khi mở group dialog, truyền vào state groupInfoDialog
  const handleShowGroupInfo = async (conv: ChatConversation) => {
    if (!conv || conv.type !== "group" || !conv.conversationId) return;
    let users: any[] = groupUsersMap[conv.id] || [];
    let groupOwner: string | undefined = groupOwnerMap[conv.id]
      || conv.owner
      || groupCache[String(conv.conversationId)]?.owner
      || undefined;
    if (!users.length) {
      try {
        const result = await apiGetGroupUser(conv.conversationId.toString());
        users = Array.isArray(result?.users) ? result.users : [];
        setGroupUsersMap((prev) => ({
          ...prev,
          [conv.id]: users,
        }));
        if (result && result.owner) {
          groupOwner = result.owner;
          setGroupOwnerMap((prev) => ({
            ...prev,
            [conv.id]: groupOwner,
          }));
        }
      } catch (err) {
        users = [];
      }
    }
    setGroupInfoDialog({
      open: true,
      users,
      conv,
      ownerId: groupOwner
    });
  };

  const handleCloseGroupInfoDialog = () => {
    setGroupInfoDialog({
      open: false,
      users: [],
      conv: null,
      ownerId: undefined,
    });
  };

  // ---------- BEGIN: Hàm xử lý giải tán nhóm ----------
  const handleDisbandGroup = () => {
    if (groupInfoDialog.conv && groupInfoDialog.conv.type === "group") {
      setShowDisbandGroupDialog({
        open: true,
        groupName: groupInfoDialog.conv.title,
        conversationId: groupInfoDialog.conv.conversationId,
      });
    }
  };
  const handleConfirmDisbandGroup = async () => {
    if (showDisbandGroupDialog.conversationId) {
      try {
        const res = await apiDisbandGroupConversation(showDisbandGroupDialog.conversationId.toString());
        console.log(res)
        if (res && res.success) {
          toast.success(res.message);
        }
      } catch (err) {
        toast.warn(getErrorMessage(err))
      }
    }
    setShowDisbandGroupDialog({ open: false });
  };
  const handleCancelDisbandGroup = () => {
    setShowDisbandGroupDialog({ open: false });
  };
  // ---------- END: Hàm xử lý giải tán nhóm ----------

  // ---------- BEGIN: Hàm xử lý rời nhóm ----------
  const handleLeaveGroup = () => {
    if (groupInfoDialog.conv && groupInfoDialog.conv.type === "group") {
      setShowLeaveGroupDialog({
        open: true,
        groupName: groupInfoDialog.conv.title,
        conversationId: groupInfoDialog.conv.conversationId,
      });
    }
  };
  const handleConfirmLeaveGroup = async () => {
    if (showLeaveGroupDialog.conversationId) {
      try {
        const res = await apiLeaveGroupConversation(showLeaveGroupDialog.conversationId.toString());
        if (res && res.success) {
          toast.success(res.message);
        }
      } catch (err) {
        toast.warn(getErrorMessage(err))
      }
    }
    setShowLeaveGroupDialog({ open: false });
  };
  const handleCancelLeaveGroup = () => {
    setShowLeaveGroupDialog({ open: false });
  };
  // ---------- END: Hàm xử lý rời nhóm ----------

  if (openConversations.length === 0 && minimizedConversations.length === 0) return null;

  return (
    <>
      {/* Group Info Dialog */}
      {groupInfoDialog.open && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 999998,
            background: "rgba(20,20,26,0.73)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={handleCloseGroupInfoDialog}
        >
          <div
            style={{
              background: "#23272c",
              borderRadius: 12,
              padding: "32px 30px 26px 30px",
              minWidth: 340,
              maxWidth: 420,
              boxShadow: "0 12px 32px 0 rgba(0,0,0,0.18)",
              border: "1px solid #222",
              color: "#fff",
              fontSize: 15,
              maxHeight: "80vh",
              overflowY: "auto",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Group Name at the Top */}
            {groupInfoDialog.conv?.title && (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 10,
                  wordBreak: "break-word"
                }}
              >
                {groupInfoDialog.conv.title}
              </div>
            )}
            {/* Danh sách thành viên */}
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 500, marginBottom: 7 }}>Thành viên nhóm:</div>
            <div>
              <div style={{ padding: "10px 0", marginBottom: 4 }}>
                {groupInfoDialog.users.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#b3b3b3", padding: "8px 0" }}>
                    Không có thành viên nào.
                  </div>
                ) : (
                  <ul
                    className="flex flex-col gap-2 custom-scroll"
                    style={{ maxHeight: "750px", overflowY: "auto" }}
                  >
                    {groupInfoDialog.users.map(u => (
                      <li
                        key={u.userId}
                        className="flex items-center gap-3 group cursor-pointer hover:bg-[#353f4b] px-2 py-2 rounded-full transition"
                        style={{ fontSize: 15 }}
                        onClick={() => {
                          if (u.userId !== userId) {
                            handleGoToUserProfile(u.userId);
                            setGroupInfoDialog({ open: false, users: [], conv: null, ownerId: undefined });
                          }
                        }}
                      >
                        <span>
                          {u.avatar ? (
                            <img
                              src={getCloudinaryImageLink(u.avatar, u.avatarCroppedArea, 32)}
                              className="w-8 h-8 rounded-full object-cover"
                              alt={u.name}
                            />
                          ) : (
                            <span className="w-8 h-8 flex items-center justify-center bg-gray-600 rounded-full text-white text-xs" style={{ minWidth: 32 }}>
                              {u.name?.[0]?.toUpperCase() || "?"}
                            </span>
                          )}
                        </span>
                        <span
                          className="font-semibold select-text flex items-center gap-1"
                          style={{
                            color: "#fff",
                            fontWeight: groupInfoDialog.ownerId && u.userId === groupInfoDialog.ownerId ? 700 : 500,
                          }}
                        >
                          {/* Hiển thị vương miện trước tên của owner */}
                          {groupInfoDialog.ownerId && u.userId === groupInfoDialog.ownerId && (
                            <FontAwesomeIcon icon={faCrown} style={{ color: "#ffd84a", fontSize: "15px", verticalAlign: "middle", marginRight: 2 }} />
                          )}
                          {u.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {/* Thêm nút Giải tán nhóm hoặc Rời nhóm */}
            {groupInfoDialog.conv?.type === "group" && groupInfoDialog.ownerId === userId && (
              <button
                type="button"
                style={{
                  marginTop: 18,
                  background: "#e11d48",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  width: "100%",
                  transition: "background 0.2s",
                }}
                onClick={handleDisbandGroup}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLElement).style.background = "#c70037")
                }
                onMouseLeave={e =>
                  ((e.currentTarget as HTMLElement).style.background = "#e11d48")
                }
              >
                Giải tán nhóm
              </button>
            )}
            {groupInfoDialog.conv?.type === "group" && groupInfoDialog.ownerId !== userId && (
              <button
                type="button"
                style={{
                  marginTop: 18,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  width: "100%",
                  transition: "background 0.2s",
                }}
                onClick={handleLeaveGroup}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLElement).style.background = "#204bba")
                }
                onMouseLeave={e =>
                  ((e.currentTarget as HTMLElement).style.background = "#2563eb")
                }
              >
                Rời nhóm
              </button>
            )}
            {/* -- End thêm nút Giải tán nhóm hoặc Rời nhóm -- */}
            <button
              type="button"
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-[#2c333c] hover:bg-[#444d59] text-white rounded-full transition"
              style={{ fontSize: 22, border: "none", cursor: "pointer" }}
              title="Đóng"
              onClick={handleCloseGroupInfoDialog}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận giải tán nhóm */}
      {showDisbandGroupDialog.open && (
        <div
          style={{
            position: "fixed",
            zIndex: 999999,
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(20,20,26,0.73)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              background: "#23272c",
              borderRadius: 12,
              padding: "28px 28px 17px 28px",
              minWidth: 340,
              maxWidth: 400,
              boxShadow: "0 12px 32px 0 rgba(0,0,0,0.19)",
              border: "1px solid #222",
              color: "#fff",
              fontSize: 15,
              maxHeight: "80vh",
              overflowY: "auto",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: "#e11d48", marginBottom: 10 }}>
              Xác nhận giải tán nhóm
            </div>
            <div style={{ marginBottom: 22, textAlign: "center", color: "#fff" }}>
              Bạn có chắc muốn giải tán nhóm chat <b>{showDisbandGroupDialog.groupName}</b>?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: 8 }}>
              <button
                type="button"
                onClick={handleCancelDisbandGroup}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  fontWeight: 500,
                  fontSize: 14,
                  background: "#454856",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleConfirmDisbandGroup}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 14,
                  background: "#e11d48",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#c70037")}
                onMouseLeave={e => (e.currentTarget.style.background = "#e11d48")}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Xác nhận rời nhóm */}
      {showLeaveGroupDialog.open && (
        <div
          style={{
            position: "fixed",
            zIndex: 1000000,
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(20,20,26,0.73)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              background: "#23272c",
              borderRadius: 12,
              padding: "28px 28px 17px 28px",
              minWidth: 340,
              maxWidth: 400,
              boxShadow: "0 12px 32px 0 rgba(0,0,0,0.19)",
              border: "1px solid #222",
              color: "#fff",
              fontSize: 15,
              maxHeight: "80vh",
              overflowY: "auto",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: "#2563eb", marginBottom: 10 }}>
              Xác nhận rời nhóm
            </div>
            <div style={{ marginBottom: 22, textAlign: "center", color: "#fff" }}>
              Bạn có chắc muốn rời nhóm chat <b>{showLeaveGroupDialog.groupName}</b>?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: 8 }}>
              <button
                type="button"
                onClick={handleCancelLeaveGroup}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  fontWeight: 500,
                  fontSize: 14,
                  background: "#454856",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleConfirmLeaveGroup}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 14,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#204bba")}
                onMouseLeave={e => (e.currentTarget.style.background = "#2563eb")}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report dialog */}
      {reportDialog.open && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 999999,
            background: "rgba(20,20,26,0.73)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              background: "#212225",
              borderRadius: 10,
              padding: "30px 20px 20px 20px",
              minWidth: 320,
              boxShadow: "0 12px 32px 0 rgba(0,0,0,0.22)",
              border: "1px solid #222",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e53935", marginBottom: 8 }}>Báo cáo người dùng</div>
            <div style={{ fontSize: 15, color: "#eee", marginBottom: 18 }}>
              Bạn có chắc chắn muốn báo cáo tin nhắn của người dùng này không?
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReportCancel}
                className="px-3 py-1 rounded bg-gray-600 text-white hover:bg-gray-500"
              >
                Huỷ
              </button>
              <button
                onClick={handleReportConfirm}
                className="px-3 py-1 cursor-pointer rounded bg-red-600 text-white hover:bg-red-500 font-semibold"
              >
                Báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ... (the rest of render unchanged) ... */}
      <div
        className="fixed right-0 z-100 flex items-end gap-3 select-none"
        style={{
          bottom: 0,
          marginBottom: 0,
        }}
      >
        {/* Minimized tab icons */}
        <div className="flex flex-col-reverse items-center gap-2 !mb-2">
          {minimizedConversations.map((c) => (
            <div
              key={c.id}
              className="relative"
              style={{ width: 48, height: 48, marginBottom: 12, marginRight: 0 }}
            >
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-semibold shadow-lg transition"
                style={{
                  marginRight: 0,
                  paddingRight: 0,
                  cursor: "pointer",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 48,
                  height: 48,
                  zIndex: 1,
                  marginBottom: 8,
                }}
                onClick={() => handleOpenConversation(c.id)}
                title={c.title}
                tabIndex={0}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.filter =
                    "brightness(1.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.filter = "";
                }}
              >
                {minimizedUnread[c.id] && minimizedUnread[c.id] > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      background: "#e11d48",
                      color: "#fff",
                      minWidth: 18,
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: 9,
                      fontSize: 12,
                      fontWeight: 700,
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                      boxSizing: "border-box",
                      boxShadow: "0 0 0 2px #444",
                    }}
                  >
                    {minimizedUnread[c.id]}
                  </span>
                )}
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.title}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg">
                    {c.title?.[0]?.toUpperCase() || "C"}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(c.id);
                }}
                className="absolute bg-[#23272f] hover:bg-[#e11d48] hover:text-white text-gray-400 transition-all border-none rounded-full flex items-center justify-center"
                style={{
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  zIndex: 2,
                  fontSize: 12,
                  boxShadow: "0 1px 6px rgba(0,0,0,.17)",
                  cursor: "pointer",
                  border: "1px solid #444",
                }}
                title="Đóng"
                tabIndex={0}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Tabs đang mở */}
        <div className="flex flex-row-reverse gap-3">
          {openConversations.map((conv) => {
            const groupUsers = conv.type === "group" && conv.conversationId
              ? groupUsersMap[conv.id] || []
              : [];
            const groupOwnerId = conv.type === "group"
              ? (groupOwnerMap[conv.id] || conv.owner || groupCache[String(conv.conversationId)]?.owner)
              : undefined;

            // --- GROUP MESSAGE LOGIC (KHÔNG bundle nữa nếu là tin nhắn đầu ngày!) ---
            // Sửa: Chia group theo day, và CHO DÙ CÙNG 1 USER LIỀN NHAU NHỮNG tin nhắn đầu ngày vẫn tách bundle

            const getMessageBundlesByDay = (messages: ChatMessage[]) => {
              let bundles: Array<{
                senderId: string,
                senderName?: string,
                groupUserAvatar?: string | null,
                groupUserAvatarCroppedArea?: any,
                messages: Array<{ m: ChatMessage, idx: number }>
              }> = [];
              let lastBundle: any = null;
              let lastSenderId: string | undefined = undefined;
              let lastDateStr: string | undefined = undefined;

              for (let idx = 0; idx < messages.length; ++idx) {
                const m = messages[idx];
                const isOutgoing =
                  m.isOutgoing !== undefined
                    ? m.isOutgoing
                    : m.senderId === userId;
                const dObj = new Date(m.createdAt);
                const dateStr = [
                  dObj.getDate(),
                  dObj.getMonth(),
                  dObj.getFullYear()
                ].join("-");
                if (
                  isOutgoing ||
                  !lastBundle ||
                  lastSenderId !== m.senderId ||
                  lastDateStr !== dateStr
                ) {
                  if (lastBundle) bundles.push(lastBundle);
                  let groupUserName = m.senderName || "";
                  let groupUserAvatar: string | null = null;
                  let groupUserAvatarCroppedArea: any = null;

                  if (conv.type === "group" && m.senderId) {
                    const member = groupUsers.find(u => u.userId === m.senderId);
                    if (member) {
                      groupUserName = member.name || m.senderName || "";
                      groupUserAvatar = member.avatar;
                      groupUserAvatarCroppedArea = member.avatarCroppedArea;
                    }
                  }
                  lastBundle = {
                    senderId: m.senderId,
                    senderName: groupUserName,
                    groupUserAvatar,
                    groupUserAvatarCroppedArea,
                    messages: [{ m, idx }]
                  };
                  lastSenderId = isOutgoing ? undefined : m.senderId;
                  lastDateStr = dateStr;
                } else {
                  lastBundle.messages.push({ m, idx });
                }
              }
              if (lastBundle) bundles.push(lastBundle);
              return bundles;
            };

            const isTimeGap = (mPrev: ChatMessage | undefined, mCur: ChatMessage) => {
              if (!mPrev) return false;
              const diff = getMinutesDiff(mPrev.createdAt, mCur.createdAt);
              return diff > 59;
            };

            const DateDivider = ({
              children,
              title
            }: {
              children: React.ReactNode;
              title?: string;
            }) => (
              <div className="flex flex-col items-center justify-center my-3 w-full">
                <span
                  className="text-[11.5px] text-[#a3a3a3] font-normal tracking-[.1px] bg-none rounded-none px-0"
                  title={title}
                >
                  {children}
                </span>
                <div
                  className="w-[80%] bg-red-50 h-px mt-0 mb-0"
                />
              </div>
            );

            const DateDividerBubble = ({
              children,
              title
            }: {
              children: React.ReactNode;
              title?: string;
            }) => (
              <div className="flex justify-center my-3 w-full">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#292c2f] text-gray-300"
                  title={title}
                >
                  {children}
                </span>
              </div>
            );

            // ======= Thay đổi phần tiêu đề click =======
            return (
              <div
                key={conv.id}
                className="bg-[#17181a] text-white shadow-2xl border border-[#2f3133] flex flex-col overflow-hidden"
                style={{
                  borderRadius: 0,
                  width: 330,
                  minWidth: 330,
                  maxWidth: 330,
                  height: 575,
                  minHeight: 575,
                  maxHeight: 575,
                  marginBottom: 0,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#1f2125] border-b border-[#2e3033]">
                  <div
                    className="flex items-center gap-2 cursor-pointer group"
                    tabIndex={0}
                    title={conv.type === "group" ? "Xem thành viên nhóm" : "Xem hồ sơ người dùng"}
                    style={{ userSelect: "none" }}
                    onClick={async () => {
                      if (conv.type === "private") {
                        if (conv.id && conv.id !== userId) handleGoToUserProfile(conv.id.toString());
                      } else if (conv.type === "group") {
                        handleShowGroupInfo(conv);
                      }
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold">
                      {conv.avatarUrl ? (
                        <img
                          src={conv.avatarUrl}
                          alt={conv.title}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{conv.title?.[0]?.toUpperCase() || "C"}</span>
                      )}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span
                        className="text-sm font-semibold truncate group-hover:underline group-hover:text-blue-400"
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                      >
                        {/* Vương miện trước tên nếu là owner của group */}
                        {conv.type === "group" && groupOwnerId && userId && groupOwnerId === userId && (
                          <FontAwesomeIcon icon={faCrown} style={{ color: "#ffd84a", fontSize: "15px", verticalAlign: "middle", marginRight: 2 }} />
                        )}
                        {conv.title}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Đang hoạt động
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-full border-none"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: "transparent",
                        transition: "background-color 0.2s",
                        fontSize: 21,
                        color: "#e11d48",
                        cursor: "pointer",
                      }}
                      title="Báo cáo & chặn người dùng"
                      onClick={() => handleReport(conv)}
                      onMouseEnter={e =>
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                        "#36253d"
                      }
                      onMouseLeave={e =>
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent"
                      }
                    >
                      <FontAwesomeIcon icon={faFlag} />
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-full border-none"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: "transparent",
                        transition: "background-color 0.2s",
                        fontSize: 24,
                        color: "#2563eb",
                        cursor: "pointer",
                      }}
                      onClick={() => handleMinimize(conv.id)}
                      title="Thu gọn"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#35383d")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-full border-none"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: "transparent",
                        transition: "background-color 0.2s",
                        fontSize: 28,
                        color: "#2563eb",
                        cursor: "pointer",
                      }}
                      onClick={() => handleClose(conv.id)}
                      title="Đóng"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#35383d")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Danh sách tin nhắn */}
                {/* ... message list unchanged ... */}
                <div
                  className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scroll"
                  style={{ maxHeight: 575 - 98 }}
                  ref={el => {
                    chatPanelsRef.current[conv.id] = el;
                  }}
                  onScroll={handleChatPanelScroll(conv.id, conv.messages, conv.conversationId)}
                >
                  {/* Keep as original for message rendering */}
                  {tabLoading[conv.id] ? (
                    <div className="flex items-center justify-center h-full py-8">
                      <span className="text-xs text-gray-500 flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Đang tải tin nhắn...
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Omitted for brevity: keep your message rendering block as in original */}
                      {/* ... */}
                      {conv.type === "group"
                        ? (() => {
                          const bundles = getMessageBundlesByDay(conv.messages);
                          let prevBundleLastMsg: ChatMessage | undefined = undefined;
                          return bundles.map((bundle, bundleIdx) => {
                            const firstMsg = bundle.messages[0].m;
                            const firstMsgGlobalIdx = bundle.messages[0].idx;
                            const lastMsg = bundle.messages[bundle.messages.length - 1].m;

                            const isOutgoing =
                              firstMsg.isOutgoing !== undefined
                                ? firstMsg.isOutgoing
                                : firstMsg.senderId === userId;

                            const hasTimeGapWithPrev =
                              !!prevBundleLastMsg && getMinutesDiff(prevBundleLastMsg.createdAt, firstMsg.createdAt) > 59;

                            const showDayDivider = isFirstMessageOfDay_Bundle(conv.messages, firstMsgGlobalIdx);

                            prevBundleLastMsg = lastMsg;
                            const { date, time, full } = formatDateTime(firstMsg.createdAt);

                            if (isOutgoing) {
                              return bundle.messages.map(({ m, idx }, k) => {
                                const globalIdx = idx;
                                const showDivider = isFirstMessageOfDay(conv.messages, globalIdx);
                                const timeInfo = formatDateTime(m.createdAt);
                                return (
                                  <React.Fragment key={m.id ?? idx}>
                                    {showDivider && (
                                      <DateDivider title={timeInfo.full}>
                                        {timeInfo.time} - {timeInfo.date}
                                      </DateDivider>
                                    )}
                                    <div
                                      className="flex w-full justify-end"
                                      style={{
                                        marginTop: undefined,
                                      }}
                                    >
                                      <div className="flex-1 flex flex-col items-end max-w-[85%]">
                                        <div
                                          className="px-3 py-2 text-sm rounded-full break-words"
                                          style={{
                                            background: "#2458F8",
                                            color: "#fff",
                                          }}
                                          title={timeInfo.full}
                                        >
                                          {m.message}
                                        </div>
                                      </div>
                                    </div>
                                  </React.Fragment>
                                );
                              });
                            }

                            return (
                              <React.Fragment key={bundle.senderId + '-' + bundleIdx}>
                                {showDayDivider && (
                                  <DateDivider title={full}>
                                    {time} - {date}
                                  </DateDivider>
                                )}
                                <div
                                  style={{
                                    marginTop: hasTimeGapWithPrev ? 17 : undefined,
                                  }}
                                >
                                  {bundle.senderName && (
                                    <div
                                      className="mb-0.5 cursor-pointer hover:underline"
                                      style={{
                                        fontSize: 12,
                                        color: "#a0a0a0",
                                        fontWeight: 600,
                                        paddingLeft: AVATAR_SPACE,
                                      }}
                                      title={formatDateTime(firstMsg.createdAt).full}
                                      onClick={() =>
                                        bundle.senderId && bundle.senderId !== userId
                                          ? handleGoToUserProfile(bundle.senderId)
                                          : undefined
                                      }
                                    >
                                      {bundle.senderName}
                                    </div>
                                  )}
                                  {bundle.messages.map(({ m, idx }, i) => {
                                    const isLast = i === bundle.messages.length - 1;
                                    const isTimeGapFromPrev =
                                      i === 0
                                        ? false
                                        : getMinutesDiff(
                                          bundle.messages[i - 1].m.createdAt,
                                          m.createdAt
                                        ) > 59;
                                    const { full: mFull } = formatDateTime(m.createdAt);
                                    return (
                                      <div
                                        key={m.id ?? idx}
                                        className="flex items-start w-full max-w-[85%]"
                                        style={{
                                          marginBottom: isLast ? 6 : 2,
                                          marginTop: isTimeGapFromPrev ? 17 : undefined,
                                        }}
                                      >
                                        {!isLast ? (
                                          <div style={{ width: 32, minWidth: 32, minHeight: 32, marginRight: 8 }} />
                                        ) : (
                                          <div style={{ marginRight: 8 }}>
                                            {bundle.groupUserAvatar ? (
                                              <img
                                                src={
                                                  getCloudinaryImageLink(
                                                    bundle.groupUserAvatar,
                                                    bundle.groupUserAvatarCroppedArea,
                                                    32
                                                  )
                                                }
                                                alt={bundle.senderName}
                                                className="w-8 h-8 rounded-full object-cover cursor-pointer"
                                                style={{ minWidth: 32, minHeight: 32 }}
                                                onClick={() =>
                                                  bundle.senderId && bundle.senderId !== userId
                                                    ? handleGoToUserProfile(bundle.senderId)
                                                    : undefined
                                                }
                                              />
                                            ) : (
                                              <div
                                                className="w-8 h-8 flex items-center justify-center bg-gray-500 rounded-full text-white text-xs cursor-pointer"
                                                style={{ minWidth: 32, minHeight: 32 }}
                                                onClick={() =>
                                                  bundle.senderId && bundle.senderId !== userId
                                                    ? handleGoToUserProfile(bundle.senderId)
                                                    : undefined
                                                }
                                              >
                                                {bundle.senderName?.[0]?.toUpperCase() || "?"}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="flex-1 flex flex-col items-start">
                                          <div
                                            className="px-3 py-2 text-sm rounded-full break-words"
                                            style={{
                                              background: "#303030",
                                              color: "#fff",
                                            }}
                                            title={mFull}
                                          >
                                            {m.message}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()
                        : (() => {
                          let prevMsg: ChatMessage | undefined = undefined;
                          return conv.messages.map((m, idx) => {
                            const { date, time, full } = formatDateTime(m.createdAt);
                            const isOutgoing =
                              m.isOutgoing !== undefined
                                ? m.isOutgoing
                                : m.senderId === userId;
                            const isTimeGapFromPrev =
                              idx === 0
                                ? false
                                : getMinutesDiff(
                                  conv.messages[idx - 1].createdAt,
                                  m.createdAt
                                ) > 59;

                            prevMsg = m;

                            const showDayDivider = isFirstMessageOfDay(conv.messages, idx);

                            return (
                              <React.Fragment key={m.id ?? idx}>
                                {showDayDivider && (
                                  <DateDivider title={full}>
                                    {time} - {date}
                                  </DateDivider>
                                )}
                                <div
                                  className={`flex w-full ${isOutgoing ? "justify-end" : "justify-start"
                                    }`}
                                  style={{
                                    marginTop: isTimeGapFromPrev ? 17 : undefined,
                                  }}
                                >
                                  <div
                                    className={`max-w-[85%] flex flex-col ${isOutgoing ? "items-end" : "items-start"
                                      }`}
                                  >
                                    {(m.senderName ?? "").trim() !== "" && (
                                      <span
                                        className={"mb-0.5" + (!isOutgoing && m.senderId && m.senderId !== userId ? " cursor-pointer hover:underline" : "")}
                                        style={{
                                          fontSize: 12,
                                          color: "#a0a0a0",
                                          fontWeight: 600,
                                          paddingLeft: !isOutgoing ? AVATAR_SPACE : undefined,
                                        }}
                                        title={full}
                                        onClick={
                                          !isOutgoing && m.senderId && m.senderId !== userId
                                            ? () => handleGoToUserProfile(m.senderId)
                                            : undefined
                                        }
                                      >
                                        {m.senderName}
                                      </span>
                                    )}
                                    <div
                                      className="px-3 py-2 text-sm rounded-full break-words"
                                      style={{
                                        background: isOutgoing ? "#2458F8" : "#303030",
                                        color: "#fff",
                                      }}
                                      title={full}
                                    >
                                      {m.message}
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}
                      {conv.messages.length === 0 && (
                        <div className="text-xs text-gray-500 text-center py-4">
                          Hãy bắt đầu cuộc trò chuyện...
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Ô nhập tin nhắn */}
                <div className="border-t border-[#2e3033] px-3 py-2 bg-[#1b1d20]">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-[#121316] text-sm text-white px-3 py-2 rounded-full outline-none border border-transparent focus:border-blue-500"
                      placeholder="Nhập tin nhắn..."
                      value={drafts[conv.id] || ""}
                      onChange={(e) =>
                        handleChangeDraft(conv.id, e.target.value)
                      }
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          await handleSend(conv.id);
                        }
                      }}
                      disabled={false || !!tabLoading[conv.id]}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 text-sm rounded-full bg-[#2563eb] text-white font-semibold hover:brightness-110 disabled:opacity-50"
                      onClick={async () => await handleSend(conv.id)}
                      disabled={
                        !((drafts[conv.id] || "").trim().length) || !!tabLoading[conv.id]
                      }
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ChatDock;
