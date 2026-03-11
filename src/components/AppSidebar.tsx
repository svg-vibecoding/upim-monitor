import { LayoutDashboard, FileText, PlusCircle, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();

  const items = [
    { title: "Inicio", url: "/", icon: Home },
    { title: "Informes", url: "/informes", icon: FileText },
    { title: "Nuevo Informe", url: "/nuevo-informe", icon: PlusCircle },
  ];

  if (user?.role === "usuario_pro") {
    items.push({ title: "Administración", url: "/admin", icon: Settings });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          {!collapsed && (
            <div className="mb-1">
              <h2 className="text-sm font-bold tracking-wide text-sidebar-foreground">UPIM</h2>
              <p className="text-[11px] text-sidebar-muted leading-tight">Monitor de Completitud</p>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <span className="text-xs font-bold text-sidebar-foreground">U</span>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
