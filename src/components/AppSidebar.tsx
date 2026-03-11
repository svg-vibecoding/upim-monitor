import { BarChart3, FileText, PlusCircle, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import upimLogo from "@/assets/upim-logo.png";
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

  const mainItems = [
    { title: "Inicio", url: "/", icon: BarChart3 },
    { title: "Informes", url: "/informes", icon: FileText },
    { title: "Nuevo Informe", url: "/nuevo-informe", icon: PlusCircle },
  ];

  const proItems = [
    { title: "Administración", url: "/admin", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          {!collapsed && (
            <div className="mb-1">
              <img src={upimLogo} alt="UPIM" className="h-5 w-auto" />
              <p className="text-[11px] text-sidebar-muted leading-tight mt-1">Monitor de Completitud</p>
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
              {mainItems.map((item) => (
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

        {user?.role === "usuario_pro" && (
          <SidebarGroup>
            {!collapsed && (
              <p className="px-4 pt-2 pb-1 text-[11px] font-medium text-sidebar-muted uppercase tracking-wider">Pro</p>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {proItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}
