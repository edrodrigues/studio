"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, FileText, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirebase, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, doc, updateDoc, limit } from "firebase/firestore";
import { useAuthContext } from "@/context/auth-context";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TemplateNotification } from "@/lib/types";

export function NotificationsDropdown() {
  const { user } = useAuthContext();
  const { firestore } = useFirebase();
  const [open, setOpen] = useState(false);

  // Buscar notificações do usuário - usando useMemoFirebase para memoizar a query
  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
  }, [firestore, user]);

  const { data: notifications, isLoading } = useCollection<TemplateNotification>(notificationsQuery);

  // Contar não lidas
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Marcar uma notificação como lida
  const markAsRead = async (notificationId: string) => {
    if (!firestore) return;
    
    try {
      await updateDoc(doc(firestore, "notifications", notificationId), {
        read: true,
      });
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!firestore || !notifications) return;
    
    const unreadNotifications = notifications.filter((n) => !n.read);
    
    try {
      await Promise.all(
        unreadNotifications.map((n) =>
          updateDoc(doc(firestore, "notifications", n.id), { read: true })
        )
      );
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  // Se não estiver logado, não mostrar
  if (!user) return null;

  // Ícone baseado no tipo
  const getIcon = (type: TemplateNotification["type"]) => {
    switch (type) {
      case "template_updated":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "template_sync_error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "template_sync_success":
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-2xl hover:bg-primary/5 transition-colors"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        className="w-96 rounded-2xl p-0 glass dark:glass-dark border-border/50 shadow-2xl"
        align="end"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <DropdownMenuLabel className="font-bold text-lg font-serif p-0">
            Notificações
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma notificação</p>
              <p className="text-sm mt-1">
                Você será notificado quando houver atualizações nos templates oficiais.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {notifications?.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 p-4 cursor-pointer border-b border-border/30 last:border-0 ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${!notification.read ? "text-primary" : ""}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>

        <DropdownMenuSeparator className="bg-border/50" />
        
        <DropdownMenuItem
          asChild
          className="rounded-b-2xl focus:bg-primary/5 focus:text-primary p-4 cursor-pointer"
        >
          <Link href="/admin/template-sync" className="flex items-center justify-center w-full text-sm font-medium">
            Ver todas as notificações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
